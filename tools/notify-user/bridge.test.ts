/**
 * Integration tests for telegram-bridge.ts.
 *
 * Uses TWO real OS-process bridge clients sharing one real local receiver, with
 * the external Telegram HTTP layer mocked at the network boundary only.
 *
 * Env contract (all loopback-guarded by bridge):
 *   TELEGRAM_API_BASE     – mock server base URL
 *   TELEGRAM_SOCKET_DIR   – per-test temp dir for receiver socket isolation
 *   TELEGRAM_IDLE_GRACE_MS – shortened for fast shutdown assertions
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";

// ─── mock Telegram HTTP server ────────────────────────────────────────────────

interface SentMessage {
 _msgId: number;
 text?: string;
 chat_id?: string | number;
 parse_mode?: string;
 /** Current Telegram API: reply_parameters.message_id, not reply_to_message_id. */
 reply_parameters?: { message_id: number };
 reply_markup?: {
  inline_keyboard?: Array<Array<{ text: string; callback_data: string }>>;
 };
}

interface AnsweredCallback {
 callback_query_id: string;
 text?: string;
 show_alert?: boolean;
}

interface MessageReaction {
 chat_id: string;
 message_id: number;
 reaction: Array<{ type: "emoji"; emoji: string }>;
}

interface MockServer {
 baseUrl: string;
 pushUpdate(u: Record<string, unknown>): void;
 editedMessages(): SentMessage[];
 sentMessages(): SentMessage[];
 answeredCallbacks(): AnsweredCallback[];
 reactions(): MessageReaction[];
 failReaction(mode: "api" | "network"): void;
 getUpdatesCallCount(): number;
 getMaxConcurrentGetUpdates(): number;
 /** Fail the Nth sendMessage (1-based count from current total). */
 failAtMessage(n: number): void;
 close(): Promise<void>;
}

function startMockServer(token: string): Promise<MockServer> {
 const updates: Record<string, unknown>[] = [];
 const sentMessages: SentMessage[] = [];
 const editedMessages: SentMessage[] = [];
 const answeredCallbacks: AnsweredCallback[] = [];
 const reactions: MessageReaction[] = [];
 let reactionFailure: "api" | "network" | undefined;
 let nextUpdateId = 1;
 let nextMsgId = 1;
 let totalSentCount = 0;
 let failAtCount = -1; // 1-based; -1 = don't fail
 let getUpdatesCallCount = 0;
 let activeGetUpdates = 0;
 let maxConcurrentGetUpdates = 0;
 const longPollWaiters: Array<(u: Record<string, unknown>[]) => void> = [];

 function pushUpdate(u: Record<string, unknown>): void {
  const full = { update_id: nextUpdateId++, ...u };
  updates.push(full);
  longPollWaiters.shift()?.([full]);
 }

 function jsonReply(res: ServerResponse, data: unknown): void {
  if (res.destroyed || res.headersSent) return;
  const body = JSON.stringify(data);
  res.writeHead(200, { "content-type": "application/json" });
  res.end(body);
 }

 const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let body = "";
  req.on("data", (c: Buffer) => { body += c.toString(); });
  req.on("end", () => {
   const parsed: Record<string, unknown> = body ? JSON.parse(body) : {};

   if (url.pathname === `/bot${token}/sendMessage`) {
    totalSentCount++;
    if (failAtCount > 0 && totalSentCount === failAtCount) {
     failAtCount = -1;
     if (!res.destroyed) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error_code: 500, description: "Injected test failure" }));
     }
     return;
    }
    const msgId = nextMsgId++;
    sentMessages.push({ _msgId: msgId, ...(parsed as Omit<SentMessage, "_msgId">) });
    jsonReply(res, { ok: true, result: { message_id: msgId } });

   } else if (url.pathname === `/bot${token}/getUpdates`) {
    getUpdatesCallCount++;
    activeGetUpdates++;
    maxConcurrentGetUpdates = Math.max(maxConcurrentGetUpdates, activeGetUpdates);
    // Accept offset from JSON body (POST) or query string (GET).
    const offset = Number(parsed.offset ?? url.searchParams.get("offset") ?? 0);
    const pending = updates.filter((u) => (u.update_id as number) >= offset);

    if (pending.length > 0) {
     activeGetUpdates--;
     jsonReply(res, { ok: true, result: pending });
    } else {
     let resolved = false;
     const resolve = (newUpdates: Record<string, unknown>[]) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      activeGetUpdates--;
      jsonReply(res, {
       ok: true,
       result: newUpdates.filter((u) => (u.update_id as number) >= offset),
      });
     };
     // Short timeout keeps tests fast on empty queues.
     const timer = setTimeout(() => {
      const idx = longPollWaiters.indexOf(resolve);
      if (idx >= 0) longPollWaiters.splice(idx, 1);
      resolve([]);
     }, 300);
     longPollWaiters.push(resolve);
     // Clean up if receiver disconnects mid-poll (killed, or connection closed).
     req.socket.on("close", () => {
      const idx = longPollWaiters.indexOf(resolve);
      if (idx >= 0) longPollWaiters.splice(idx, 1);
      resolve([]); // no-op if timer already fired
     });
    }

   } else if (url.pathname === `/bot${token}/answerCallbackQuery`) {
    answeredCallbacks.push({
     callback_query_id: String(parsed.callback_query_id),
     ...(typeof parsed.text === "string" ? { text: parsed.text } : {}),
    });
    jsonReply(res, { ok: true, result: true });

   } else if (url.pathname === `/bot${token}/editMessageText`) {
    const msgId = Number(parsed.message_id);
    const message = sentMessages.find((item) => item._msgId === msgId);
    if (!message) {
     jsonReply(res, { ok: false, error_code: 400, description: "Message not found" });
     return;
    }
    Object.assign(message, parsed);
    editedMessages.push({ ...message });
    jsonReply(res, { ok: true, result: { message_id: msgId } });

   } else if (url.pathname === `/bot${token}/setMessageReaction`) {
    reactions.push(parsed as unknown as MessageReaction);
    const failure = reactionFailure;
    reactionFailure = undefined;
    if (failure === "network") {
     req.socket.destroy();
    } else if (failure === "api") {
     jsonReply(res, { ok: false, error_code: 400, description: "Reaction not allowed" });
    } else {
     jsonReply(res, { ok: true, result: true });
    }

   } else {
    jsonReply(res, { ok: true, result: { url: "" } });
   }
  });
 });

 return new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => {
   const { port } = server.address() as AddressInfo;
   resolve({
    baseUrl: `http://127.0.0.1:${port}`,
    pushUpdate,
    sentMessages: () => [...sentMessages],
    editedMessages: () => [...editedMessages],
    answeredCallbacks: () => [...answeredCallbacks],
    reactions: () => [...reactions],
    failReaction(mode) { reactionFailure = mode; },
    getUpdatesCallCount: () => getUpdatesCallCount,
    getMaxConcurrentGetUpdates: () => maxConcurrentGetUpdates,
    failAtMessage(n) { failAtCount = totalSentCount + n; },
    close: () => new Promise<void>((r) => {
     // Force-close all connections so outstanding long-polls don't block shutdown.
     // The socket-close events trigger resolve([]) on each pending waiter.
     server.closeAllConnections();
     server.close(() => r());
    }),
   });
  });
 });
}

// ─── bridge client child-process manager ─────────────────────────────────────

const FIXTURE = path.resolve(fileURLToPath(import.meta.url), "../client-fixture.ts");
const CHAT_ID = "99887766";
const DEFAULT_GRACE_MS = 1500; // short for fast test teardown

let tokenSuffix = 0;
let cbCounter = 0;

function freshToken(): string {
 return `test-tok-${Date.now()}-${++tokenSuffix}`;
}

type AnyEvent = { type: string } & Record<string, unknown>;

class BridgeClient {
 readonly proc: ReturnType<typeof spawn>;
 private buf = "";
 private readonly eventQueue: AnyEvent[] = [];
 private readonly waiters: Array<{ resolve(e: AnyEvent): void; reject(e: Error): void }> = [];

 constructor(token: string, apiBase: string, socketDir: string, graceMs = DEFAULT_GRACE_MS) {
  this.proc = spawn("node", ["--experimental-strip-types", FIXTURE], {
   env: {
    ...process.env,
    BRIDGE_TOKEN: token,
    BRIDGE_CHAT_ID: CHAT_ID,
    TELEGRAM_API_BASE: apiBase,
    TELEGRAM_SOCKET_DIR: socketDir,
    TELEGRAM_IDLE_GRACE_MS: String(graceMs),
   },
   stdio: ["pipe", "pipe", "inherit"],
  });

  this.proc.stdout!.on("data", (chunk: Buffer) => {
   this.buf += chunk.toString();
   const lines = this.buf.split("\n");
   this.buf = lines.pop()!;
   for (const line of lines) {
    if (!line.trim()) continue;
    this.deliver(JSON.parse(line) as AnyEvent);
   }
  });

  this.proc.on("error", (err: Error) => {
   for (const w of this.waiters) w.reject(err);
   this.waiters.length = 0;
  });
 }

 private deliver(ev: AnyEvent): void {
  const w = this.waiters.shift();
  if (w) w.resolve(ev);
  else this.eventQueue.push(ev);
 }

 nextEvent(timeoutMs = 8000): Promise<AnyEvent> {
  if (this.eventQueue.length > 0) return Promise.resolve(this.eventQueue.shift()!);
  return new Promise((resolve, reject) => {
   // Capture waiter by reference so the timer can remove it by identity.
   let waiter: { resolve(e: AnyEvent): void; reject(e: Error): void };
   const timer = setTimeout(() => {
    const idx = this.waiters.indexOf(waiter);
    if (idx >= 0) this.waiters.splice(idx, 1);
    reject(new Error(`Timed out after ${timeoutMs}ms waiting for event`));
   }, Math.max(1, timeoutMs));
   waiter = {
    resolve(e) { clearTimeout(timer); resolve(e); },
    reject,
   };
   this.waiters.push(waiter);
  });
 }

 async expectType(type: string, timeoutMs = 8000): Promise<AnyEvent> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
   const remaining = deadline - Date.now();
   if (remaining <= 0) throw new Error(`Timed out after ${timeoutMs}ms waiting for "${type}"`);
   const ev = await this.nextEvent(remaining);
   if (ev.type === type) return ev;
  }
 }

 send(text: string, details?: string): void {
  this.proc.stdin!.write(
   JSON.stringify({ cmd: "send", text, ...(details !== undefined && { details }) }) + "\n",
  );
 }

 command(cmd: string, fields: Record<string, unknown> = {}): void {
  this.proc.stdin!.write(JSON.stringify({ cmd, ...fields }) + "\n");
 }

 closeGracefully(): void {
  this.proc.stdin!.write(JSON.stringify({ cmd: "close" }) + "\n");
 }

 kill(): void { this.proc.kill("SIGKILL"); }
}

// ─── per-test cleanup ─────────────────────────────────────────────────────────

const teardowns: Array<() => Promise<void> | void> = [];
afterEach(async () => {
 // Kill clients first so receiver detects idle state; then close mock server.
 await Promise.all(teardowns.splice(0).map((f) => f()));
}, 15000);

async function freshSocketDir(): Promise<string> {
 // macOS Unix socket paths must fit in 104 bytes.
 const dir = await mkdtemp(path.join(process.platform === "darwin" ? "/tmp" : os.tmpdir(), "janus-tg-test-"));
 teardowns.push(() => rm(dir, { recursive: true, force: true }));
 return dir;
}

async function setup(): Promise<{
 server: MockServer;
 clientA: BridgeClient;
 clientB: BridgeClient;
}> {
 const token = freshToken();
 const server = await startMockServer(token);
 const socketDir = await freshSocketDir();
 teardowns.push(() => server.close());

 const clientA = new BridgeClient(token, server.baseUrl, socketDir);
 const clientB = new BridgeClient(token, server.baseUrl, socketDir);
 teardowns.push(() => { clientA.kill(); clientB.kill(); });

 return { server, clientA, clientB };
}

// ─── update helpers ───────────────────────────────────────────────────────────

function userUpdate(extra: Record<string, unknown>): Record<string, unknown> {
 const uid = parseInt(CHAT_ID, 10);
 return {
  message: {
   message_id: Math.floor(Math.random() * 1_000_000),
   from: { id: uid, is_bot: false, first_name: "Tester" },
   chat: { id: uid, type: "private" },
   ...extra,
  },
 };
}

function replyUpdate(replyToMsgId: number, text: string): Record<string, unknown> {
 return userUpdate({ text, reply_to_message: { message_id: replyToMsgId } });
}

function callbackUpdate(botMsgId: number, data: string): Record<string, unknown> {
 const uid = parseInt(CHAT_ID, 10);
 return {
  callback_query: {
   id: `cq-${++cbCounter}`,
   from: { id: uid, is_bot: false, first_name: "Tester" },
   message: { message_id: botMsgId, chat: { id: uid, type: "private" } },
   data,
  },
 };
}

// ─── crash/restart helpers ────────────────────────────────────────────────────

/** Socket path formula matches bridge: SHA256(token)[:20]. */
function receiverSocketPath(socketDir: string, token: string): string {
 const hash = createHash("sha256").update(token).digest("hex").slice(0, 20);
 return path.join(socketDir, hash, "receiver.sock");
}

function findReceiverPid(socketPath: string, excludePids: number[]): number | null {
 try {
  const out = execFileSync("lsof", ["-n", "-U", "-Fpn"], { encoding: "utf8" });
  let pid = 0;
  for (const line of out.split("\n")) {
   if (line.startsWith("p")) pid = Number(line.slice(1));
   if (line.startsWith("n") && line.includes(socketPath) && !excludePids.includes(pid)) return pid;
  }
  return null;
 } catch {
  return null;
 }
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("telegram-bridge", () => {

 test("question buttons and custom replies route only to their originating session", { timeout: 18000 }, async () => {
  const { server, clientA, clientB } = await setup();
  await clientA.expectType("ready");
  await clientB.expectType("ready");
  const buttons = [[{ text: "1", action: "ask-a:storage:1" }, { text: "2", action: "ask-a:storage:2" }]];
  clientA.command("sendInteractive", { text: "Storage?", replyAction: "ask-a:storage", buttons });
  const sent = await clientA.expectType("interactiveSent");
  clientB.command("sendInteractive", { text: "Deployment?", replyAction: "ask-b:deployment", buttons: [[{ text: "1", action: "ask-b:deployment:1" }]] });
  await clientB.expectType("interactiveSent");
  const message = server.sentMessages().find((item) => item._msgId === sent.msgId)!;
  const token = message.reply_markup!.inline_keyboard![0][1].callback_data;
  expect(token.length).toBeLessThanOrEqual(64);
  server.pushUpdate(callbackUpdate(message._msgId, token));
  expect(await clientA.expectType("action")).toMatchObject({ action: "ask-a:storage:2" });
  await vi.waitFor(() => expect(server.answeredCallbacks().some((item) => item.text === "Answer received")).toBe(true));
  server.pushUpdate(replyUpdate(message._msgId, "my database"));
  expect(await clientA.expectType("action")).toMatchObject({ action: "ask-a:storage", text: "my database" });
  clientB.command("ping");
  expect(await clientB.nextEvent()).toMatchObject({ type: "pong" });

  clientA.command("editInteractive", { msgId: message._msgId, text: "✓ SQLite selected", buttons: [[{ text: "✓ 1", action: "ask-a:storage:1" }, buttons[0][1]]] });
  await clientA.expectType("edited");
  expect(server.editedMessages().at(-1)?.text).toBe("✓ SQLite selected");
  expect(server.editedMessages().at(-1)?.reply_markup?.inline_keyboard?.[0][1].callback_data).toBe(token);
  clientA.command("editInteractive", { msgId: message._msgId, text: "Submitted", buttons: [] });
  await clientA.expectType("edited");
  const before = server.answeredCallbacks().length;
  server.pushUpdate(callbackUpdate(message._msgId, token));
  await vi.waitFor(() => expect(server.answeredCallbacks().length).toBeGreaterThan(before));
  clientA.command("ping");
  expect(await clientA.nextEvent()).toMatchObject({ type: "pong" });
 });

 test("question callbacks acknowledge acceptance only after the tool accepts the answer", { timeout: 18000 }, async () => {
  const { server, clientA } = await setup();
  await clientA.expectType("ready");
  clientA.command("sendInteractive", { text: "Choose", buttons: [[{ text: "1", action: "choice" }]] });
  const sent = await clientA.expectType("interactiveSent");
  const token = server.sentMessages()[0].reply_markup!.inline_keyboard![0][0].callback_data;
  clientA.command("holdReplies");
  await clientA.expectType("holdingReplies");
  server.pushUpdate(callbackUpdate(Number(sent.msgId), token));
  await clientA.expectType("action");
  expect(server.answeredCallbacks()).toHaveLength(0);
  clientA.command("rejectReply");
  await vi.waitFor(() => expect(server.answeredCallbacks()).toHaveLength(1));
  expect(server.answeredCallbacks()[0].text).toContain("no longer available");
 });

 test("question callbacks reject forged message ownership and unauthorized senders", { timeout: 18000 }, async () => {
  const { server, clientA } = await setup();
  await clientA.expectType("ready");
  clientA.command("sendInteractive", { text: "Choose", buttons: [[{ text: "1", action: "choice" }]] });
  const sent = await clientA.expectType("interactiveSent");
  const token = server.sentMessages()[0].reply_markup!.inline_keyboard![0][0].callback_data;
  const unauthorized = callbackUpdate(Number(sent.msgId), token) as { callback_query: { from: { id: number } } };
  unauthorized.callback_query.from.id++;
  server.pushUpdate(unauthorized);
  server.pushUpdate(callbackUpdate(Number(sent.msgId) + 1, token));
  await vi.waitFor(() => expect(server.answeredCallbacks()).toHaveLength(2));
  clientA.command("ping");
  expect(await clientA.nextEvent()).toMatchObject({ type: "pong" });
 });

 // ── 1. singleton receiver proof ──────────────────────────────────────────────

 test("both clients share exactly one receiver (singleton getUpdates poller)", { timeout: 18000 }, async () => {
  const { server, clientA, clientB } = await setup();

  await clientA.expectType("ready");
  clientA.send("Hello from A");
  await clientA.expectType("sent");

  await clientB.expectType("ready");
  clientB.send("Hello from B");
  await clientB.expectType("sent");

  // Push a reply to flush any buffered polls and produce an extra poll cycle.
  const msgA = server.sentMessages().find((m) => m.text === "Hello from A")!;
  server.pushUpdate(replyUpdate(msgA._msgId, "ping"));
  await clientA.expectType("reply");

  const texts = server.sentMessages().map((m) => m.text);
  expect(texts).toContain("Hello from A");
  expect(texts).toContain("Hello from B");

  // Singleton invariant: only one getUpdates outstanding at a time.
  expect(server.getMaxConcurrentGetUpdates()).toBe(1);
 });

 // ── 2. reply routing ─────────────────────────────────────────────────────────

 test("text replies routed only to the message owner", { timeout: 18000 }, async () => {
  const { server, clientA, clientB } = await setup();

  await clientA.expectType("ready");
  clientA.send("Msg A");
  await clientA.expectType("sent");

  await clientB.expectType("ready");
  clientB.send("Msg B");
  await clientB.expectType("sent");

  const msgA = server.sentMessages().find((m) => m.text === "Msg A")!;
  const msgB = server.sentMessages().find((m) => m.text === "Msg B")!;

  server.pushUpdate(replyUpdate(msgA._msgId, "reply to A"));
  const ra = await clientA.expectType("reply");
  expect(ra.text).toBe("reply to A");

  server.pushUpdate(replyUpdate(msgB._msgId, "reply to B"));
  const rb = await clientB.expectType("reply");
  expect(rb.text).toBe("reply to B");

  // Confirm no cross-delivery: push a second B reply and flush, A stays silent.
  server.pushUpdate(replyUpdate(msgB._msgId, "b again"));
  await clientB.expectType("reply");
  expect(clientA["eventQueue"].length).toBe(0);
 });

 test("eyes reaction waits for session acceptance; rejected replies get no reaction", { timeout: 18000 }, async () => {
  const { server, clientA } = await setup();
  await clientA.expectType("ready");
  clientA.send("Summary");
  await clientA.expectType("sent");
  const summary = server.sentMessages().find((m) => m.text === "Summary")!;
  clientA.command("holdReplies");
  await clientA.expectType("holdingReplies");

  server.pushUpdate(userUpdate({
   message_id: 10001,
   text: "continue",
   reply_to_message: { message_id: summary._msgId },
  }));
  expect((await clientA.expectType("reply")).text).toBe("continue");
  await new Promise<void>((resolve) => setTimeout(resolve, 200));
  expect(server.reactions()).toEqual([]);

  clientA.command("acceptReply");
  await vi.waitFor(() => {
   expect(server.reactions()).toEqual([{
    chat_id: CHAT_ID,
    message_id: 10001,
    reaction: [{ type: "emoji", emoji: "👀" }],
   }]);
  }, { timeout: 5000 });

  server.pushUpdate(userUpdate({
   message_id: 10002,
   text: "stale reply",
   reply_to_message: { message_id: summary._msgId },
  }));
  await clientA.expectType("reply");
  clientA.command("rejectReply");
  await vi.waitFor(() => {
   expect(server.sentMessages().some((m) =>
    m.reply_parameters?.message_id === 10002 &&
    m.text?.includes("Could not deliver reply") &&
    m.text.includes("The originating session is no longer available."),
   )).toBe(true);
  }, { timeout: 5000 });
  expect(server.reactions().map((r) => r.message_id)).toEqual([10001]);
 });

 test.each(["api", "network"] as const)("reaction %s failure warns without failing or repeating delivery", { timeout: 18000 }, async (mode) => {
  const { server, clientA } = await setup();
  await clientA.expectType("ready");
  clientA.send("Summary");
  await clientA.expectType("sent");
  const summary = server.sentMessages().find((m) => m.text === "Summary")!;
  server.failReaction(mode);
  server.pushUpdate(replyUpdate(summary._msgId, "continue"));
  expect((await clientA.expectType("reply")).text).toBe("continue");
  const warning = await clientA.expectType("warning");
  expect(warning.message).toContain("reply received, but reaction failed");
  if (mode === "api") expect(warning.message).toContain("Telegram 400: Reaction not allowed");
  expect(server.sentMessages().some((m) => m.text?.includes("Could not deliver reply"))).toBe(false);
  expect(server.reactions()).toHaveLength(1);

  server.pushUpdate(replyUpdate(summary._msgId, "next reply"));
  expect((await clientA.expectType("reply")).text).toBe("next reply");
  await vi.waitFor(() => expect(server.reactions()).toHaveLength(2), { timeout: 5000 });
  expect(clientA["eventQueue"]).toEqual([]);
 });

 // ── 3. details delivery ───────────────────────────────────────────────────────

 test("details: button format, reply_parameters, chunk routing, cross-client isolation", { timeout: 18000 }, async () => {
  const { server, clientA, clientB } = await setup();

  await clientA.expectType("ready");
  clientA.send("Summary A", "Plain details for A");
  await clientA.expectType("sent");

  await clientB.expectType("ready");
  clientB.send("Summary B", "Plain details for B");
  await clientB.expectType("sent");

  const summaryA = server.sentMessages().find((m) => m.text === "Summary A")!;
  expect(summaryA).toBeDefined();

  const button = summaryA.reply_markup?.inline_keyboard?.[0]?.[0];
  expect(button).toBeDefined();
  // Button label must contain "Details".
  expect(button!.text).toContain("Details");
  // Callback token: 32 hex chars → 32 ASCII bytes ≤ 64.
  expect(button!.callback_data).toMatch(/^[0-9a-f]{32}$/);
  expect(Buffer.byteLength(button!.callback_data, "utf8")).toBeLessThanOrEqual(64);

  server.pushUpdate(callbackUpdate(summaryA._msgId, button!.callback_data));

  await vi.waitFor(() => {
   expect(server.answeredCallbacks().length).toBeGreaterThan(0);
  }, { timeout: 5000 });
  expect(server.answeredCallbacks()[0]!.callback_query_id).toBeTruthy();

  await vi.waitFor(() => {
   expect(server.sentMessages().some((m) => m.text === "Plain details for A")).toBe(true);
  }, { timeout: 5000 });

  const detailMsg = server.sentMessages().find((m) => m.text === "Plain details for A")!;
  // Details must be plain text (no HTML parse mode).
  expect(detailMsg.parse_mode).toBeUndefined();
  // Must use current Telegram reply_parameters API.
  expect(detailMsg.reply_parameters?.message_id).toBe(summaryA._msgId);

  // Reply to detail chunk routes back to A.
  server.pushUpdate(replyUpdate(detailMsg._msgId, "reply to A detail"));
  const rA = await clientA.expectType("reply");
  expect(rA.text).toBe("reply to A detail");

  // Reply to B's summary routes only to B.
  const summaryB = server.sentMessages().find((m) => m.text === "Summary B")!;
  server.pushUpdate(replyUpdate(summaryB._msgId, "reply to B"));
  const rB = await clientB.expectType("reply");
  expect(rB.text).toBe("reply to B");
  expect(clientA["eventQueue"].length).toBe(0);
 });

 // ── 4. same-session older snapshot retention ──────────────────────────────────

 test("pressing older Details button delivers older reply, not newest", { timeout: 18000 }, async () => {
  const { server, clientA } = await setup();

  await clientA.expectType("ready");

  // First notification.
  clientA.send("First summary", "First reply content");
  await clientA.expectType("sent");
  const firstSummary = server.sentMessages().find((m) => m.text === "First summary")!;
  const firstButton = firstSummary.reply_markup?.inline_keyboard?.[0]?.[0];
  expect(firstButton).toBeDefined();

  // Second notification (different details).
  clientA.send("Second summary", "Second reply content");
  await clientA.expectType("sent");

  // Press the OLDER (first) button after the newer notification exists.
  server.pushUpdate(callbackUpdate(firstSummary._msgId, firstButton!.callback_data));

  await vi.waitFor(() => {
   expect(server.answeredCallbacks().length).toBeGreaterThan(0);
  }, { timeout: 5000 });

  await vi.waitFor(() => {
   expect(server.sentMessages().some((m) => m.text === "First reply content")).toBe(true);
  }, { timeout: 5000 });

  // The OLDER reply must appear — not the newer one.
  const delivered = server.sentMessages().find((m) => m.text === "First reply content")!;
  expect(delivered).toBeDefined();
  expect(delivered.reply_parameters?.message_id).toBe(firstSummary._msgId);

  // Second reply content must NOT have been delivered yet.
  expect(server.sentMessages().some((m) => m.text === "Second reply content")).toBe(false);
 });

 // ── 5. long text split ────────────────────────────────────────────────────────

 test("text >4096 chars split at Unicode boundary; HTML literal; no surrogate split", { timeout: 18000 }, async () => {
  const { server, clientA } = await setup();

  await clientA.expectType("ready");

  // Emoji at position 4094 so a naive byte-split would land inside it.
  const prefix = "A".repeat(4094);
  const emoji = "🔥"; // U+1F525 — two UTF-16 code units (0xD83D 0xDD25)
  const longDetails = prefix + emoji + "B".repeat(200) + "\n<b>bold</b> & <code>code</code>";
  expect(longDetails.length).toBeGreaterThan(4096);

  clientA.send("Summary", longDetails);
  await clientA.expectType("sent");

  const summary = server.sentMessages().find((m) => m.text === "Summary")!;
  const button = summary.reply_markup?.inline_keyboard?.[0]?.[0];
  expect(button).toBeDefined();

  server.pushUpdate(callbackUpdate(summary._msgId, button!.callback_data));
  await vi.waitFor(() => {
   expect(server.answeredCallbacks().length).toBeGreaterThan(0);
  }, { timeout: 5000 });

  await vi.waitFor(() => {
   expect(server.sentMessages().some((m) => m.text?.startsWith("A".repeat(100)))).toBe(true);
  }, { timeout: 8000 });

  const chunks = server
   .sentMessages()
   .filter((m) => m.text && (m.text.startsWith("A") || m.text.includes("🔥") || m.text.includes("<b>")));

  for (const chunk of chunks) {
   // No chunk exceeds Telegram's 4096-char limit.
   expect(chunk.text!.length).toBeLessThanOrEqual(4096);

   // Must not end on a high surrogate (0xD800–0xDBFF) — that would be an unpaired lead.
   const lastCode = chunk.text!.charCodeAt(chunk.text!.length - 1);
   const endsHighSurrogate = lastCode >= 0xd800 && lastCode <= 0xdbff;
   expect(endsHighSurrogate, `chunk ends on high surrogate 0x${lastCode.toString(16)}`).toBe(false);

   // Must not begin on a low surrogate (0xDC00–0xDFFF) — that would be an unpaired trail.
   const firstCode = chunk.text!.charCodeAt(0);
   const startsLowSurrogate = firstCode >= 0xdc00 && firstCode <= 0xdfff;
   expect(startsLowSurrogate, `chunk starts on low surrogate 0x${firstCode.toString(16)}`).toBe(false);

   // Plain text details must not have an HTML parse mode.
   expect(chunk.parse_mode).toBeUndefined();
  }

  // Lossless reconstruction.
  const reconstructed = chunks.map((c) => c.text!).join("");
  expect(reconstructed).toBe(longDetails);

  // Literal HTML must survive unescaped.
  expect(reconstructed).toContain("<b>bold</b>");
  expect(reconstructed).not.toContain("&amp;");
  expect(reconstructed).not.toContain("&lt;");
 });

 // ── 6. auth: wrong chat ID ────────────────────────────────────────────────────

 test("updates from wrong chat ID are ignored", { timeout: 18000 }, async () => {
  const { server, clientA } = await setup();

  await clientA.expectType("ready");
  clientA.send("Probe");
  await clientA.expectType("sent");
  const msgId = server.sentMessages()[0]!._msgId;

  server.pushUpdate({
   message: {
    message_id: 600,
    from: { id: 11111, is_bot: false, first_name: "Hacker" },
    chat: { id: 11111, type: "private" },
    text: "inject",
    reply_to_message: { message_id: msgId },
   },
  });
  // Sentinel: legit reply confirms receiver processed the bad update and moved on.
  server.pushUpdate(replyUpdate(msgId, "legit"));
  const ev = await clientA.expectType("reply");
  expect(ev.text).toBe("legit");
  expect(clientA["eventQueue"].length).toBe(0);
 });

 // ── 7. auth: bot sender ───────────────────────────────────────────────────────

 test("updates from bot senders are ignored", { timeout: 18000 }, async () => {
  const { server, clientA } = await setup();

  await clientA.expectType("ready");
  clientA.send("Probe");
  await clientA.expectType("sent");
  const msgId = server.sentMessages()[0]!._msgId;
  const uid = parseInt(CHAT_ID, 10);

  server.pushUpdate({
   message: {
    message_id: 601,
    from: { id: uid, is_bot: true, first_name: "Bot" },
    chat: { id: uid, type: "private" },
    text: "bot injection",
    reply_to_message: { message_id: msgId },
   },
  });
  server.pushUpdate(replyUpdate(msgId, "human reply"));
  const ev = await clientA.expectType("reply");
  expect(ev.text).toBe("human reply");
  expect(clientA["eventQueue"].length).toBe(0);
 });

 // ── 8. auth: same-chat wrong from.id ─────────────────────────────────────────

 test("same-chat wrong from.id rejected", { timeout: 18000 }, async () => {
  const { server, clientA } = await setup();

  await clientA.expectType("ready");
  clientA.send("Probe");
  await clientA.expectType("sent");
  const msgId = server.sentMessages()[0]!._msgId;
  const uid = parseInt(CHAT_ID, 10);

  // chat.id correct but from.id is a different user.
  server.pushUpdate({
   message: {
    message_id: 602,
    from: { id: uid + 1, is_bot: false, first_name: "Impostor" },
    chat: { id: uid, type: "private" },
    text: "impostor injection",
    reply_to_message: { message_id: msgId },
   },
  });
  server.pushUpdate(replyUpdate(msgId, "real reply"));
  const ev = await clientA.expectType("reply");
  expect(ev.text).toBe("real reply");
  expect(clientA["eventQueue"].length).toBe(0);
 });

 // ── 9. auth: forwarded messages ───────────────────────────────────────────────

 test("forwarded messages (forward_date / forward_origin) are rejected", { timeout: 18000 }, async () => {
  const { server, clientA } = await setup();

  await clientA.expectType("ready");
  clientA.send("Probe");
  await clientA.expectType("sent");
  const msgId = server.sentMessages()[0]!._msgId;
  const uid = parseInt(CHAT_ID, 10);

  // forward_date marks a forwarded message.
  server.pushUpdate({
   message: {
    message_id: 603,
    from: { id: uid, is_bot: false, first_name: "Tester" },
    chat: { id: uid, type: "private" },
    text: "forwarded injection",
    forward_date: 1_700_000_000,
    reply_to_message: { message_id: msgId },
   },
  });
  server.pushUpdate(replyUpdate(msgId, "organic reply"));
  const ev = await clientA.expectType("reply");
  expect(ev.text).toBe("organic reply");
  expect(clientA["eventQueue"].length).toBe(0);
 });

 // ── 10. partial shutdown ──────────────────────────────────────────────────────

 test("closing one client does not interrupt the other", { timeout: 18000 }, async () => {
  const { server, clientA, clientB } = await setup();

  await clientA.expectType("ready");
  clientA.send("From A");
  await clientA.expectType("sent");

  await clientB.expectType("ready");
  clientB.send("From B");
  await clientB.expectType("sent");

  const msgB = server.sentMessages().find((m) => m.text === "From B")!;

  clientA.closeGracefully();
  await clientA.expectType("closed");

  clientB.send("B alive");
  await clientB.expectType("sent");

  server.pushUpdate(replyUpdate(msgB._msgId, "reply after A closed"));
  const ev = await clientB.expectType("reply");
  expect(ev.text).toBe("reply after A closed");
 });

 // ── 11. closed owner ──────────────────────────────────────────────────────────

 test("closed owner: text reply triggers unavailable message; callback answered unavailable", { timeout: 18000 }, async () => {
  const { server, clientA, clientB } = await setup();

  await clientA.expectType("ready");
  clientA.send("From A", "A details");
  await clientA.expectType("sent");

  await clientB.expectType("ready");
  clientB.send("From B");
  await clientB.expectType("sent");

  const msgA = server.sentMessages().find((m) => m.text === "From A")!;
  const buttonA = msgA.reply_markup?.inline_keyboard?.[0]?.[0];
  expect(buttonA).toBeDefined();
  const msgB = server.sentMessages().find((m) => m.text === "From B")!;

  // Close client A.
  clientA.closeGracefully();
  await clientA.expectType("closed");

  // Text reply to A's closed message — receiver must send an "unavailable" message back.
  const sentBefore = server.sentMessages().length;
  server.pushUpdate(replyUpdate(msgA._msgId, "late reply to A"));

  // Sentinel: B processes next update, confirming receiver handled A's stale update.
  server.pushUpdate(replyUpdate(msgB._msgId, "sentinel"));
  await clientB.expectType("reply");

  // Receiver should have sent an unavailable notice to Telegram.
  await vi.waitFor(() => {
   const newMsgs = server.sentMessages().slice(sentBefore);
   expect(newMsgs.some((m) => /unavailable|session/i.test(m.text ?? ""))).toBe(true);
  }, { timeout: 5000 });

  // A's event queue must be empty — nothing delivered after close.
  expect(clientA["eventQueue"].length).toBe(0);

  // Callback query on A's closed message must be acknowledged with unavailable text.
  const cbsBefore = server.answeredCallbacks().length;
  server.pushUpdate(callbackUpdate(msgA._msgId, buttonA!.callback_data));
  await vi.waitFor(() => {
   expect(server.answeredCallbacks().length).toBeGreaterThan(cbsBefore);
  }, { timeout: 5000 });
  const cb = server.answeredCallbacks().at(-1)!;
  expect(cb.text?.toLowerCase()).toMatch(/unavailable|session/);
 });

 // ── 12. callback acknowledgement ──────────────────────────────────────────────

 test("every callback_query is acknowledged", { timeout: 18000 }, async () => {
  const { server, clientA } = await setup();

  await clientA.expectType("ready");
  clientA.send("CB test", "details text");
  await clientA.expectType("sent");

  const summaryMsg = server.sentMessages().find((m) => m.text === "CB test")!;
  const button = summaryMsg.reply_markup?.inline_keyboard?.[0]?.[0];
  expect(button).toBeDefined();

  // Two rapid clicks (double-tap); each must be acknowledged.
  server.pushUpdate(callbackUpdate(summaryMsg._msgId, button!.callback_data));
  server.pushUpdate(callbackUpdate(summaryMsg._msgId, button!.callback_data));

  await vi.waitFor(() => {
   expect(server.answeredCallbacks().length).toBeGreaterThanOrEqual(2);
  }, { timeout: 6000 });
  expect(server.answeredCallbacks().length).toBeGreaterThanOrEqual(2);
 });

 // ── 13. no duplicate delivery ─────────────────────────────────────────────────

 test("getUpdates offset advances: no duplicate delivery across polls", { timeout: 18000 }, async () => {
  const { server, clientA } = await setup();

  await clientA.expectType("ready");
  clientA.send("Probe");
  await clientA.expectType("sent");
  const msgId = server.sentMessages()[0]!._msgId;

  server.pushUpdate(replyUpdate(msgId, "first"));
  const ev1 = await clientA.expectType("reply");
  expect(ev1.text).toBe("first");

  server.pushUpdate(replyUpdate(msgId, "second"));
  const ev2 = await clientA.expectType("reply");
  expect(ev2.text).toBe("second");

  expect(clientA["eventQueue"].length).toBe(0);
 });

 // ── 14. details HTTP failure → retry ─────────────────────────────────────────

 test("transient HTTP failure on second chunk: re-pressing button delivers complete output", { timeout: 18000 }, async () => {
  const { server, clientA } = await setup();

  await clientA.expectType("ready");

  // Two-chunk details: chunk boundary falls between X-block and Y-block.
  const chunk1 = "X".repeat(4090);
  const chunk2 = "Y".repeat(200);
  const details = chunk1 + chunk2;
  expect(details.length).toBeGreaterThan(4096);

  clientA.send("Summary", details);
  await clientA.expectType("sent");

  // Message counts so far: 1 (summary). Chunk1=2, chunk2=3.
  // Fail message #3 so chunk2 fails on the first button press.
  server.failAtMessage(2); // relative to current count → absolute = 1+2 = 3rd total

  const summary = server.sentMessages().find((m) => m.text === "Summary")!;
  const button = summary.reply_markup?.inline_keyboard?.[0]?.[0];
  expect(button).toBeDefined();

  // First click — chunk1 OK, chunk2 HTTP-fails.
  server.pushUpdate(callbackUpdate(summary._msgId, button!.callback_data));
  await vi.waitFor(() => {
   expect(server.sentMessages().some((m) => m.text?.startsWith("X"))).toBe(true);
  }, { timeout: 5000 });

  // Brief settle for the error to propagate.
  await new Promise<void>((r) => setTimeout(r, 300));

  // Second click — must deliver all text (retry or full re-send).
  const cbsBefore = server.answeredCallbacks().length;
  server.pushUpdate(callbackUpdate(summary._msgId, button!.callback_data));
  await vi.waitFor(() => {
   expect(server.answeredCallbacks().length).toBeGreaterThan(cbsBefore);
  }, { timeout: 6000 });

  await vi.waitFor(() => {
   const allText = server.sentMessages().map((m) => m.text ?? "").join("");
   expect(allText).toContain(chunk2);
  }, { timeout: 6000 });

  // Verify full text is accounted for (no missing bytes).
  const allDetailText = server
   .sentMessages()
   .filter((m) => m.text?.startsWith("X") || m.text?.startsWith("Y"))
   .map((m) => m.text!)
   .join("");
  expect(allDetailText).toContain(chunk1.slice(0, 100));
  expect(allDetailText).toContain(chunk2);
 });

 // ── 15. receiver crash / restart ─────────────────────────────────────────────

 test("receiver crash: older Details snapshot and pre-crash chunk routing restored after restart", { timeout: 35000 }, async () => {
  const token = freshToken();
  const server = await startMockServer(token);
  const socketDir = await freshSocketDir();
  teardowns.push(() => server.close());

  // Longer grace so receiver doesn't self-exit during crash recovery.
  const clientA = new BridgeClient(token, server.baseUrl, socketDir, 5000);
  const clientB = new BridgeClient(token, server.baseUrl, socketDir, 5000);
  teardowns.push(() => { clientA.kill(); clientB.kill(); });

  await clientA.expectType("ready");
  clientA.send("Pre-crash A", "Details for A");
  await clientA.expectType("sent");

  await clientB.expectType("ready");
  clientB.send("Pre-crash B", "Details for B");
  await clientB.expectType("sent");

  clientB.command("sendInteractive", {
   text: "Pre-crash question", replyAction: "restored-question",
   buttons: [[{ text: "1", action: "restored-option" }]],
  });
  const questionSent = await clientB.expectType("interactiveSent");
  const question = server.sentMessages().find((message) => message._msgId === questionSent.msgId)!;
  const questionToken = question.reply_markup!.inline_keyboard![0][0].callback_data;

  // Trigger Details for A to create a chunk msgId before crash.
  const summaryA = server.sentMessages().find((m) => m.text === "Pre-crash A")!;
  const buttonA = summaryA.reply_markup?.inline_keyboard?.[0]?.[0];
  expect(buttonA).toBeDefined();

  server.pushUpdate(callbackUpdate(summaryA._msgId, buttonA!.callback_data));
  await vi.waitFor(() => {
   expect(server.sentMessages().some((m) => m.text === "Details for A")).toBe(true);
  }, { timeout: 5000 });
  const preCrashChunk = server.sentMessages().find((m) => m.text === "Details for A")!;

  // Find and kill the receiver process.
  const sockPath = receiverSocketPath(socketDir, token);
  const clientPids = [clientA.proc.pid, clientB.proc.pid].filter((p): p is number => p != null);
  const receiverPid = findReceiverPid(sockPath, clientPids);
  expect(receiverPid, "receiver process must be locatable").toBeTruthy();
  process.kill(receiverPid!, "SIGKILL");

  // Brief pause for socket to close so bridge detects disconnect.
  await new Promise<void>((r) => setTimeout(r, 300));

  // Force reconnect by sending new messages (bridge auto-spawns new receiver).
  clientA.send("Post-crash A");
  clientB.send("Post-crash B");
  await clientA.expectType("sent");
  await clientB.expectType("sent");

  // After reconnect, the OLD Details button must still work (restored snapshot).
  const cbsBefore = server.answeredCallbacks().length;
  server.pushUpdate(callbackUpdate(summaryA._msgId, buttonA!.callback_data));
  await vi.waitFor(() => {
   expect(server.answeredCallbacks().length).toBeGreaterThan(cbsBefore);
  }, { timeout: 10000 });
  await vi.waitFor(() => {
   const deliveries = server.sentMessages().filter((m) => m.text === "Details for A");
   expect(deliveries.length).toBeGreaterThan(1); // pre-crash + post-crash
  }, { timeout: 5000 });

  // Reply to pre-crash chunk msgId must route to A (chunk ownership restored).
  server.pushUpdate(replyUpdate(preCrashChunk._msgId, "reply to pre-crash chunk"));
  const replyA = await clientA.expectType("reply");
  expect(replyA.text).toBe("reply to pre-crash chunk");

  // Client B still works independently.
  const summaryB = server.sentMessages().find((m) => m.text === "Pre-crash B")!;
  server.pushUpdate(replyUpdate(summaryB._msgId, "reply to B"));
  const replyB = await clientB.expectType("reply");
  expect(replyB.text).toBe("reply to B");

  server.pushUpdate(callbackUpdate(question._msgId, questionToken));
  expect(await clientB.expectType("action")).toMatchObject({ action: "restored-option" });
  server.pushUpdate(replyUpdate(question._msgId, "after restart"));
  expect(await clientB.expectType("action")).toMatchObject({ action: "restored-question", text: "after restart" });
 });

 // ── 16. full shutdown cleanup ─────────────────────────────────────────────────

 test("receiver stops polling after all clients disconnect; fresh client can start", { timeout: 22000 }, async () => {
  const token = freshToken();
  const server = await startMockServer(token);
  const socketDir = await freshSocketDir();
  teardowns.push(() => server.close());

  // Short grace (800ms) so receiver exits quickly for this test.
  const clientA = new BridgeClient(token, server.baseUrl, socketDir, 800);
  const clientB = new BridgeClient(token, server.baseUrl, socketDir, 800);
  teardowns.push(() => { clientA.kill(); clientB.kill(); });

  await clientA.expectType("ready");
  clientA.send("Shutdown test A");
  await clientA.expectType("sent");

  await clientB.expectType("ready");
  clientB.send("Shutdown test B");
  await clientB.expectType("sent");

  clientA.closeGracefully();
  clientB.closeGracefully();
  await Promise.all([clientA.expectType("closed"), clientB.expectType("closed")]);

  const pollsBefore = server.getUpdatesCallCount();

  // Wait for grace period to expire + buffer.
  await new Promise<void>((r) => setTimeout(r, 2000));

  const pollsAfter = server.getUpdatesCallCount();

  // Fresh client must start and work (proves socket was cleaned up).
  const clientC = new BridgeClient(token, server.baseUrl, socketDir, 800);
  teardowns.push(() => { clientC.kill(); });
  await clientC.expectType("ready");
  clientC.send("Fresh start");
  await clientC.expectType("sent");

  // New receiver resumed polling.
  expect(server.getUpdatesCallCount()).toBeGreaterThan(pollsAfter);

  // During the 2s idle gap, receiver polled at most ~7 times (300ms mock timeout).
  expect(pollsAfter - pollsBefore).toBeLessThan(10);

  // Singleton still holds after restart.
  expect(server.getMaxConcurrentGetUpdates()).toBe(1);
 });

});
