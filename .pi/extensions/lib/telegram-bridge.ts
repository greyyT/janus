/**
 * telegram-bridge.ts
 *
 * Dual-purpose:
 *   - Imported: exports createTelegramBridge() for Pi extension use
 *   - Receiver: node --experimental-strip-types telegram-bridge.ts receiver <socketPath> <chatId>
 *     env: TELEGRAM_TOKEN (required), TELEGRAM_API_BASE, TELEGRAM_SOCKET_DIR, TELEGRAM_IDLE_GRACE_MS
 *
 * One receiver per bot token shared across OS processes via private Unix socket (dir 0700).
 * No Pi imports; Node builtins only.
 */

import { createHash, randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { mkdir, unlink, stat } from "node:fs/promises";
import { createServer, createConnection, type Socket, type Server } from "node:net";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// ── Test-mode guard ───────────────────────────────────────────────────────────
// TELEGRAM_API_BASE / TELEGRAM_SOCKET_DIR / TELEGRAM_IDLE_GRACE_MS are only
// honoured when TELEGRAM_API_BASE resolves to a loopback host, preventing
// accidental production override from a stray env var.
const _TEST_MODE: boolean = (() => {
 const raw = process.env["TELEGRAM_API_BASE"];
 if (!raw) return false;
 try {
  const h = new URL(raw).hostname;
  return h === "127.0.0.1" || h === "::1" || h === "localhost";
 } catch { return false; }
})();

const TELEGRAM_API_BASE = _TEST_MODE
 ? (process.env["TELEGRAM_API_BASE"] as string)
 : "https://api.telegram.org";

const SOCKET_BASE = _TEST_MODE && process.env["TELEGRAM_SOCKET_DIR"]
 ? process.env["TELEGRAM_SOCKET_DIR"]
 : join(homedir(), ".local", "share", "janus-telegram");

const IDLE_GRACE_MS = _TEST_MODE && process.env["TELEGRAM_IDLE_GRACE_MS"]
 ? Math.max(100, Number(process.env["TELEGRAM_IDLE_GRACE_MS"]))
 : 30_000;

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_MSG_CHARS = 4_096;
const POLL_TIMEOUT_SECS = 30;
const FETCH_TIMEOUT_MS = (POLL_TIMEOUT_SECS + 10) * 1_000;
const ACK_TIMEOUT_MS = 15_000;
const CONNECT_POLL_MS = 200;
const CONNECT_TIMEOUT_MS = 8_000;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const DETAILS_BUTTON = "Details";
const NEW_SOCKET_AGE_MS = 2_000; // sockets younger than this are never unlinked

// ── Protocol ──────────────────────────────────────────────────────────────────

export interface TelegramButton {
 text: string;
 action: string;
}

interface Interaction {
 replyAction?: string;
 buttons: TelegramButton[][];
 tokens: string[][];
}

interface RestoreEntry {
 msgId: number;
 cbToken?: string;
 details?: string;
 chunkMsgIds: number[];
 interaction?: Interaction;
}

type ClientMsg =
 | { type: "hello"; clientId: string; chatId: string }
 | { type: "restore"; entries: RestoreEntry[] }
 | { type: "send"; requestId: string; text: string; details?: string }
 | { type: "interactive_send"; requestId: string; text: string; replyAction?: string; buttons: TelegramButton[][] }
 | { type: "interactive_edit"; requestId: string; msgId: number; text: string; buttons: TelegramButton[][] }
 | { type: "reply_ack"; replyId: string; ok: boolean; reason?: string }
 | { type: "bye" };

type ReceiverMsg =
 | { type: "welcome"; interactive: true }
 | { type: "rejected"; reason: string }
 | { type: "sent"; requestId: string; msgId: number; cbToken?: string; details?: string; interaction?: Interaction }
 | { type: "chunk_ids"; summaryMsgId: number; chunkMsgIds: number[] }
 | { type: "reply"; replyId: string; text: string }
 | { type: "action"; replyId: string; action: string; text?: string }
 | { type: "edited"; requestId: string; msgId: number; interaction: Interaction }
 | { type: "warning"; message: string }
 | { type: "error"; requestId: string; message: string };

// ── Public API ────────────────────────────────────────────────────────────────

export interface TelegramBridgeOptions {
 token: string;
 chatId: string;
 onReply: (text: string) => void | Promise<void>;
 onAction?: (action: string, text?: string) => void | Promise<void>;
 onWarning: (message: string) => void;
}

export interface TelegramBridge {
 send(text: string, options?: { details?: string }): Promise<void>;
 sendInteractive(text: string, options: { replyAction?: string; buttons: TelegramButton[][] }): Promise<number>;
 editInteractive(msgId: number, text: string, buttons: TelegramButton[][]): Promise<void>;
 close(): void;
}

// ── Telegram API types ────────────────────────────────────────────────────────

interface TgResponse { ok: boolean; result?: unknown; description?: string; error_code?: number }
interface TgUser { id: number; is_bot: boolean }
interface TgMessage {
 message_id: number;
 from?: TgUser;
 chat: { id: number; type: string };
 text?: string;
 reply_to_message?: { message_id: number };
 forward_date?: number;
 forward_origin?: unknown;
}
interface TgCallbackQuery { id: string; from: TgUser; message?: TgMessage; data?: string }
interface TgUpdate { update_id: number; message?: TgMessage; callback_query?: TgCallbackQuery }

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms: number, sig?: AbortSignal): Promise<void> {
 return new Promise<void>((res, rej) => {
  if (sig?.aborted) { rej(sig.reason); return; }
  const t = setTimeout(res, ms);
  sig?.addEventListener("abort", () => { clearTimeout(t); rej((sig as AbortSignal).reason); }, { once: true });
 });
}

/** Strip token from fetch error messages before surfacing to callers. */
function sanitizeErr(err: unknown): string {
 return String(err).replace(/\/bot[^/\s]+\//g, "/bot[token]/");
}

/** Socket path keyed on full token hash — one receiver per bot, not per (bot, chat). */
function resolveSocketPath(token: string): string {
 const hash = createHash("sha256").update(token).digest("hex").slice(0, 20);
 return join(SOCKET_BASE, hash, "receiver.sock");
}

function chunkText(text: string, max = MAX_MSG_CHARS): string[] {
 const chunks: string[] = [];
 let i = 0;
 while (i < text.length) {
  let end = i + max;
  if (end >= text.length) { chunks.push(text.slice(i)); break; }
  const cc = text.charCodeAt(end - 1);
  if (cc >= 0xd800 && cc <= 0xdbff) end--;
  const nl = text.lastIndexOf("\n", end - 1);
  if (nl > i + max / 2) end = nl + 1;
  chunks.push(text.slice(i, end));
  i = end;
 }
 return chunks;
}

function writeMsg(socket: Socket, msg: ClientMsg | ReceiverMsg): void {
 if (!socket.destroyed) socket.write(JSON.stringify(msg) + "\n");
}

function readLines(socket: Socket, onLine: (line: string) => void, onClose: () => void): void {
 let buf = "";
 socket.on("data", (chunk: Buffer) => {
  buf += chunk.toString("utf8");
  let nl: number;
  while ((nl = buf.indexOf("\n")) !== -1) {
   const line = buf.slice(0, nl).trim();
   buf = buf.slice(nl + 1);
   if (line) onLine(line);
  }
 });
 socket.once("close", onClose);
 socket.once("error", () => socket.destroy());
}

/** Absolute source path for receiver spawn; robust under Pi jiti loader. */
const THIS_FILE: string = (() => {
 const fn = (import.meta as { filename?: string }).filename;
 if (fn) return fn;
 try { return fileURLToPath(import.meta.url); }
 catch { return new URL(import.meta.url).pathname; }
})();

// ── Client ────────────────────────────────────────────────────────────────────

export function createTelegramBridge(options: TelegramBridgeOptions): TelegramBridge {
 const { token, chatId, onReply, onAction, onWarning } = options;
 const socketPath = resolveSocketPath(token);
 const clientId = randomBytes(8).toString("hex");

 let activeSocket: Socket | null = null;
 let closed = false;
 let connectingPromise: Promise<Socket> | null = null;
 let reconnectTimer: NodeJS.Timeout | undefined;
 let supportsInteraction = false;
 const connectingSockets = new Set<Socket>();
 const pending = new Map<string, { resolve: (msgId: number) => void; reject: (e: Error) => void }>();

 // Metadata retained for routing restoration after receiver restart
 interface NotifEntry { cbToken?: string; details?: string; chunkMsgIds: number[]; interaction?: Interaction }
 const notifEntries = new Map<number, NotifEntry>(); // summaryMsgId → entry

 function handleMsg(msg: ReceiverMsg): void {
  switch (msg.type) {
   case "reply":
   case "action": {
    if (closed) return;
    const { replyId } = msg;
    const sock = activeSocket;
    void (async () => {
     if (closed || !sock || sock.destroyed) return;
     try {
      if (msg.type === "action") {
       if (!onAction) throw new Error("This questionnaire is unavailable.");
       await onAction(msg.action, msg.text);
      } else await onReply(msg.text);
      if (!closed && !sock.destroyed) writeMsg(sock, { type: "reply_ack", replyId, ok: true });
     } catch (err) {
      if (!closed && !sock.destroyed)
       writeMsg(sock, { type: "reply_ack", replyId, ok: false, reason: String(err) });
     }
    })();
    break;
   }
   case "warning":
    onWarning(msg.message);
    break;
   case "sent":
   case "edited": {
    const p = pending.get(msg.requestId);
    if (p) {
     pending.delete(msg.requestId);
     if (msg.type === "edited") {
      const entry = notifEntries.get(msg.msgId);
      if (entry) entry.interaction = msg.interaction;
     } else notifEntries.set(msg.msgId, { cbToken: msg.cbToken, details: msg.details, interaction: msg.interaction, chunkMsgIds: [] });
     p.resolve(msg.msgId);
    }
    break;
   }
   case "chunk_ids": {
    const entry = notifEntries.get(msg.summaryMsgId);
    if (entry) entry.chunkMsgIds.push(...msg.chunkMsgIds);
    break;
   }
   case "error": {
    const p = pending.get(msg.requestId);
    if (p) { pending.delete(msg.requestId); p.reject(new Error(msg.message)); }
    break;
   }
  }
 }

 function onSocketClose(): void {
  activeSocket = null;
  for (const [, p] of pending) p.reject(new Error("telegram-bridge: receiver disconnected"));
  pending.clear();
  // Autonomous reconnect while bridge is still live
  if (!closed) connectInBackground();
 }

 function tryConnect(): Promise<Socket> {
  return new Promise<Socket>((resolve, reject) => {
   const sock = createConnection(socketPath);
   connectingSockets.add(sock);
   sock.once("close", () => connectingSockets.delete(sock));
   sock.setTimeout(CONNECT_TIMEOUT_MS, () => sock.destroy());
   let welcomed = false;

   readLines(
    sock,
    (line) => {
     let msg: ReceiverMsg;
     try { msg = JSON.parse(line) as ReceiverMsg; } catch { return; }
     if (!welcomed) {
      if (msg.type === "rejected") {
       reject(new Error(`telegram-bridge: ${msg.reason}`));
       sock.destroy();
       return;
      }
      if (msg.type !== "welcome") return;
      supportsInteraction = msg.interactive === true;
      welcomed = true;
      if (closed) {
       reject(new Error("telegram-bridge: bridge is closed"));
       sock.destroy();
       return;
      }
      sock.setTimeout(0);
      activeSocket = sock;
      // Restore all notification metadata so new receiver can route replies/callbacks
      const entries = [...notifEntries.entries()].map(([msgId, e]) => ({
       msgId, cbToken: e.cbToken, details: e.details, chunkMsgIds: e.chunkMsgIds, interaction: e.interaction,
      }));
      if (entries.length > 0) writeMsg(sock, { type: "restore", entries });
      resolve(sock);
      return;
     }
     handleMsg(msg);
    },
    () => {
     if (!welcomed) reject(new Error("telegram-bridge: socket closed before welcome"));
     else onSocketClose();
    },
   );

   sock.once("connect", () => writeMsg(sock, { type: "hello", clientId, chatId }));
   sock.once("error", (err) => { if (!welcomed) reject(err); });
  });
 }

 async function spawnReceiver(): Promise<void> {
  const dir = socketPath.slice(0, socketPath.lastIndexOf("/"));
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const child = spawn(
   "node",
   ["--experimental-strip-types", THIS_FILE, "receiver", socketPath, chatId],
   {
    env: { ...process.env, TELEGRAM_TOKEN: token },
    detached: true,
    stdio: "ignore",
   },
  );
  child.once("error", (err) => onWarning(`telegram-bridge: receiver spawn failed — ${sanitizeErr(err)}`));
  child.unref();
 }

 async function getSocket(): Promise<Socket> {
  if (closed) throw new Error("telegram-bridge: bridge is closed");
  if (activeSocket && !activeSocket.destroyed) return activeSocket;
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async (): Promise<Socket> => {
   try {
    return await tryConnect();
   } catch (err) {
    // chatId mismatch or other hard failures — don't spawn/retry
    if (!(err as NodeJS.ErrnoException).code) throw err;
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ECONNREFUSED" && code !== "ENOTSOCK") throw err;
   }
   await spawnReceiver();
   const deadline = Date.now() + CONNECT_TIMEOUT_MS;
   let lastErr: unknown;
   while (Date.now() < deadline) {
    if (closed) throw new Error("telegram-bridge: bridge is closed");
    await sleep(CONNECT_POLL_MS);
    try { return await tryConnect(); } catch (e) { lastErr = e; }
   }
   throw new Error(`telegram-bridge: timed out connecting to receiver (${sanitizeErr(lastErr)})`);
  })().finally(() => { connectingPromise = null; });

  return connectingPromise;
 }

 function connectInBackground(): void {
  if (closed) return;
  void getSocket().catch((error) => {
   if (closed) return;
   onWarning(sanitizeErr(error));
   reconnectTimer = setTimeout(connectInBackground, BACKOFF_BASE_MS);
  });
 }

 connectInBackground();

 async function interactiveRequest(
  makeMessage: (requestId: string) => ClientMsg,
 ): Promise<number> {
  const sock = await getSocket();
  if (!supportsInteraction) throw new Error("The Telegram receiver needs a restart to enable question buttons. Close all Pi sessions using this bot, then reopen Pi.");
  if (closed || sock.destroyed) throw new Error("telegram-bridge: bridge is closed");
  const requestId = randomBytes(8).toString("hex");
  return new Promise<number>((resolve, reject) => {
   pending.set(requestId, { resolve, reject });
   writeMsg(sock, makeMessage(requestId));
  });
 }

 return {
  async send(text, opts) {
   const sock = await getSocket();
   if (closed || sock.destroyed) throw new Error("telegram-bridge: bridge is closed");
   const requestId = randomBytes(8).toString("hex");
   return new Promise<void>((resolve, reject) => {
    pending.set(requestId, { resolve: () => resolve(), reject });
    writeMsg(sock, { type: "send", requestId, text, details: opts?.details });
   });
  },

  sendInteractive(text, opts) {
   return interactiveRequest((requestId) => ({ type: "interactive_send", requestId, text, ...opts }));
  },

  async editInteractive(msgId, text, buttons) {
   await interactiveRequest((requestId) => ({ type: "interactive_edit", requestId, msgId, text, buttons }));
  },

  close() {
   if (closed) return;
   closed = true;
   clearTimeout(reconnectTimer);
   for (const socket of connectingSockets) socket.destroy();
   if (activeSocket && !activeSocket.destroyed) {
    writeMsg(activeSocket, { type: "bye" });
    activeSocket.destroy();
   }
   activeSocket = null;
   for (const [, p] of pending) p.reject(new Error("telegram-bridge: closed"));
   pending.clear();
  },
 };
}

// ── Receiver ──────────────────────────────────────────────────────────────────

async function telegramPost(
 token: string,
 method: string,
 body: Record<string, unknown>,
 signal: AbortSignal,
): Promise<TgResponse> {
 const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
  signal,
 });
 return res.json() as Promise<TgResponse>;
}

async function probeLive(path: string): Promise<boolean> {
 return new Promise<boolean>((res) => {
  const probe = createConnection(path);
  const t = setTimeout(() => { probe.destroy(); res(false); }, 1_000);
  probe.once("connect", () => { clearTimeout(t); probe.destroy(); res(true); });
  probe.once("error", () => { clearTimeout(t); res(false); });
 });
}

async function runReceiver(socketPath: string, chatId: string, token: string): Promise<void> {
 const clients = new Map<Socket, { clientId: string }>();
 const msgOwners = new Map<number, Socket>();          // Telegram msgId → client socket
 const deadMsgIds = new Set<number>();                  // tombstone: disconnected owner's msgIds
 const deadTokens = new Set<string>();                  // tombstone: disconnected owner's cbTokens
 const detailsMap = new Map<string, {
  text: string; summaryMsgId: number;
  sending: boolean; ownerSocket: Socket;
 }>();
 const interactions = new Map<number, Interaction>();
 const actionTokens = new Map<string, { msgId: number; action: string }>();
 const pendingReplies = new Map<string, {
  tgMsgId?: number; callbackId?: string; ownerSocket: Socket; timer: NodeJS.Timeout;
 }>();
 const abortCtrl = new AbortController();
 let idleTimer: NodeJS.Timeout | null = null;

 function startIdle(): void {
  if (idleTimer) return;
  idleTimer = setTimeout(() => {
   abortCtrl.abort();
   server.close(() => unlink(socketPath).catch(() => { }).finally(() => process.exit(0)));
  }, IDLE_GRACE_MS);
 }

 function cancelIdle(): void {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
 }

 function reportToTelegram(text: string, replyToMsgId?: number): void {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (replyToMsgId !== undefined) body["reply_parameters"] = { message_id: replyToMsgId };
  telegramPost(token, "sendMessage", body, AbortSignal.timeout(10_000)).catch(() => { });
 }

 function reportAction(pr: { tgMsgId?: number; callbackId?: string }, error?: string): void {
  if (pr.callbackId) {
   void telegramPost(token, "answerCallbackQuery", {
    callback_query_id: pr.callbackId,
    text: error ? error.slice(0, 180) : "Answer received",
    show_alert: !!error,
   }, AbortSignal.timeout(5_000)).catch(() => { });
  } else if (error) reportToTelegram(`⚠️ ${error}`, pr.tgMsgId);
 }

 function registerInteraction(msgId: number, interaction: Interaction): void {
  const previous = interactions.get(msgId);
  for (const row of previous?.tokens ?? []) {
   for (const token of row) { actionTokens.delete(token); deadTokens.add(token); }
  }
  interactions.set(msgId, interaction);
  interaction.buttons.forEach((row, i) => row.forEach((button, j) => {
   const token = interaction.tokens[i][j];
   actionTokens.set(token, { msgId, action: button.action });
   deadTokens.delete(token);
  }));
 }

 function deliverAction(owner: Socket, action: string, source: { tgMsgId?: number; callbackId?: string }, text?: string): void {
  const replyId = randomBytes(8).toString("hex");
  const timer = setTimeout(() => {
   pendingReplies.delete(replyId);
   reportAction(source, "Answer delivery timed out. Please try again.");
  }, ACK_TIMEOUT_MS);
  pendingReplies.set(replyId, { ...source, ownerSocket: owner, timer });
  writeMsg(owner, { type: "action", replyId, action, text });
 }

 function dropClient(sock: Socket): void {
  clients.delete(sock);
  for (const [id, owner] of msgOwners) {
   if (owner === sock) {
    msgOwners.delete(id); deadMsgIds.add(id);
    for (const row of interactions.get(id)?.tokens ?? []) {
     for (const token of row) { actionTokens.delete(token); deadTokens.add(token); }
    }
    interactions.delete(id);
   }
  }
  for (const [tok, d] of detailsMap) {
   if (d.ownerSocket === sock) { detailsMap.delete(tok); deadTokens.add(tok); }
  }
  for (const [id, pr] of pendingReplies) {
   if (pr.ownerSocket === sock) {
    clearTimeout(pr.timer);
    pendingReplies.delete(id);
    reportAction(pr, "Session disconnected — reply could not be delivered.");
   }
  }
  if (clients.size === 0) startIdle();
 }

 function handleReplyAck(msg: Extract<ClientMsg, { type: "reply_ack" }>): void {
  const pr = pendingReplies.get(msg.replyId);
  if (!pr) return;
  clearTimeout(pr.timer);
  pendingReplies.delete(msg.replyId);
  if (pr.callbackId) {
   reportAction(pr, msg.ok ? undefined : msg.reason ?? "Could not save this answer.");
   return;
  }
  if (!msg.ok) {
   reportToTelegram(
    `⚠️ Could not deliver reply${msg.reason ? ` — ${msg.reason}` : ""}.`,
    pr.tgMsgId,
   );
  } else {
   void telegramPost(token, "setMessageReaction", {
    chat_id: chatId,
    message_id: pr.tgMsgId,
    reaction: [{ type: "emoji", emoji: "👀" }],
   }, AbortSignal.any([abortCtrl.signal, AbortSignal.timeout(10_000)]))
    .then((resp) => {
     if (!resp.ok) throw new Error(`Telegram ${resp.error_code ?? "?"}: ${resp.description ?? "unknown"}`);
    })
    .catch((err) => {
     if (!abortCtrl.signal.aborted)
      writeMsg(pr.ownerSocket, { type: "warning", message: `telegram-bridge: reply received, but reaction failed — ${sanitizeErr(err)}` });
    });
  }
 }

 async function doSend(sock: Socket, msg: Extract<ClientMsg, { type: "send" }>): Promise<void> {
  const { requestId, text, details } = msg;
  const hasDetails = typeof details === "string" && details.length > 0;
  const cbToken = hasDetails ? randomBytes(16).toString("hex") : undefined;

  const body: Record<string, unknown> = {
   chat_id: chatId, text, parse_mode: "HTML",
   link_preview_options: { is_disabled: true },
  };
  if (cbToken) {
   body["reply_markup"] = { inline_keyboard: [[{ text: DETAILS_BUTTON, callback_data: cbToken }]] };
  }

  try {
   const resp = await telegramPost(token, "sendMessage", body,
    AbortSignal.any([abortCtrl.signal, AbortSignal.timeout(15_000)]));
   if (!resp.ok) {
    writeMsg(sock, { type: "error", requestId, message: `Telegram ${resp.error_code ?? "?"}: ${resp.description ?? "unknown"}` });
    return;
   }
   const sent = resp.result as TgMessage;
   msgOwners.set(sent.message_id, sock);
   if (cbToken && details) {
    detailsMap.set(cbToken, { text: details, summaryMsgId: sent.message_id, sending: false, ownerSocket: sock });
   }
   // Include cbToken + details snapshot so client can restore routing on receiver restart
   writeMsg(sock, { type: "sent", requestId, msgId: sent.message_id, cbToken, details });
  } catch (err) {
   if (abortCtrl.signal.aborted) return;
   writeMsg(sock, { type: "error", requestId, message: sanitizeErr(err) });
  }
 }

 async function doInteractive(sock: Socket, msg: Extract<ClientMsg, { type: "interactive_send" | "interactive_edit" }>): Promise<void> {
  const { requestId, text, buttons } = msg;
  try {
   if (text.length > MAX_MSG_CHARS || buttons.flat().length > 100 || buttons.some((row) => row.length > 8)) {
    throw new Error("Interactive message exceeds Telegram limits.");
   }
   const editing = msg.type === "interactive_edit";
   if (editing && (msgOwners.get(msg.msgId) !== sock || !interactions.has(msg.msgId))) {
    throw new Error("This question message is unavailable.");
   }
   const previous = editing ? interactions.get(msg.msgId)! : undefined;
   const tokens = buttons.map((row, i) => row.map((button, j) =>
    previous?.buttons[i]?.[j]?.action === button.action ? previous.tokens[i][j] : randomBytes(16).toString("hex"),
   ));
   const interaction: Interaction = {
    replyAction: editing ? previous?.replyAction : msg.replyAction,
    buttons, tokens,
   };
   const body = {
    chat_id: chatId, text,
    ...(editing ? { message_id: msg.msgId } : {}),
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: buttons.map((row, i) => row.map((button, j) => ({ text: button.text, callback_data: tokens[i][j] }))) },
   };
   const resp = await telegramPost(token, editing ? "editMessageText" : "sendMessage", body,
    AbortSignal.any([abortCtrl.signal, AbortSignal.timeout(15_000)]));
   if (!resp.ok && !(editing && resp.description?.includes("message is not modified"))) {
    throw new Error(`Telegram ${resp.error_code ?? "?"}: ${resp.description ?? "unknown"}`);
   }
   const msgId = editing ? msg.msgId : (resp.result as TgMessage).message_id;
   if (sock.destroyed || !clients.has(sock)) {
    deadMsgIds.add(msgId);
    for (const row of tokens) for (const token of row) deadTokens.add(token);
    return;
   }
   msgOwners.set(msgId, sock);
   registerInteraction(msgId, interaction);
   writeMsg(sock, { type: editing ? "edited" : "sent", requestId, msgId, interaction });
  } catch (err) {
   writeMsg(sock, { type: "error", requestId, message: sanitizeErr(err) });
  }
 }

 async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.message) {
   const msg = update.message;
   // Private-chat-only; reject bots, forwarded messages, wrong sender
   if (msg.chat.type !== "private" || String(msg.chat.id) !== chatId ||
    !msg.from || msg.from.is_bot || String(msg.from.id) !== chatId ||
    msg.forward_date !== undefined || msg.forward_origin !== undefined) return;

   if (msg.reply_to_message && msg.text) {
    const refId = msg.reply_to_message.message_id;
    const owner = msgOwners.get(refId);
    if (owner && !owner.destroyed) {
     const interaction = interactions.get(refId);
     if (interaction) {
      if (interaction.replyAction) deliverAction(owner, interaction.replyAction, { tgMsgId: msg.message_id }, msg.text);
      else reportToTelegram("Reply to a question message to write a custom answer.", msg.message_id);
      return;
     }
     const replyId = randomBytes(8).toString("hex");
     const tgMsgId = msg.message_id;
     const timer = setTimeout(() => {
      if (!pendingReplies.has(replyId)) return;
      pendingReplies.delete(replyId);
      reportToTelegram("⚠️ Reply delivery timed out.", tgMsgId);
     }, ACK_TIMEOUT_MS);
     pendingReplies.set(replyId, { tgMsgId, ownerSocket: owner, timer });
     writeMsg(owner, { type: "reply", replyId, text: msg.text });
    } else if (deadMsgIds.has(refId)) {
     reportToTelegram("⚠️ This session is no longer active.", msg.message_id);
    }
   }
  }

  if (update.callback_query) {
   const cq = update.callback_query;
   const authorized = !cq.from.is_bot && String(cq.from.id) === chatId &&
    (!cq.message || (cq.message.chat.type === "private" && String(cq.message.chat.id) === chatId));
   const action = cq.data ? actionTokens.get(cq.data) : undefined;
   if (authorized && action && cq.message?.message_id === action.msgId) {
    const owner = msgOwners.get(action.msgId);
    if (owner && !owner.destroyed) {
     deliverAction(owner, action.action, { callbackId: cq.id });
     return;
    }
   }

   const unavailable = authorized && cq.data && deadTokens.has(cq.data);
   await telegramPost(token, "answerCallbackQuery", {
    callback_query_id: cq.id,
    ...(unavailable ? { text: "The originating session is unavailable." } : {}),
   }, AbortSignal.any([abortCtrl.signal, AbortSignal.timeout(5_000)])).catch(() => { });

   if (!authorized || !cq.data) return;

   const detail = detailsMap.get(cq.data);
   if (!detail) {
    if (deadTokens.has(cq.data)) reportToTelegram("⚠️ Session ended — details no longer available.");
    return;
   }
   // Verify callback originates from the message that has the button
   if (cq.message && cq.message.message_id !== detail.summaryMsgId) return;
   if (detail.sending) return;
   detail.sending = true;

   const chunkMsgIds: number[] = [];
   let allOk = true;
   for (const chunk of chunkText(detail.text)) {
    if (abortCtrl.signal.aborted) { detail.sending = false; return; }
    try {
     const resp = await telegramPost(token, "sendMessage",
      { chat_id: chatId, text: chunk, reply_parameters: { message_id: detail.summaryMsgId } },
      AbortSignal.any([abortCtrl.signal, AbortSignal.timeout(15_000)]));
     if (resp.ok) {
      const cid = (resp.result as TgMessage).message_id;
      msgOwners.set(cid, detail.ownerSocket);
      chunkMsgIds.push(cid);
     } else {
      allOk = false;
     }
    } catch { allOk = false; }
   }

   detail.sending = false;
   if (chunkMsgIds.length > 0 && !detail.ownerSocket.destroyed) {
    writeMsg(detail.ownerSocket, { type: "chunk_ids", summaryMsgId: detail.summaryMsgId, chunkMsgIds });
   }
   if (!allOk) {
    reportToTelegram("Some details could not be sent. Press Details to try again.", detail.summaryMsgId);
   }
  }
 }

 async function poll(): Promise<void> {
  let offset = 0;
  let backoff = BACKOFF_BASE_MS;
  while (!abortCtrl.signal.aborted) {
   try {
    const resp = await telegramPost(token, "getUpdates",
     { offset, timeout: POLL_TIMEOUT_SECS, allowed_updates: ["message", "callback_query"] },
     AbortSignal.any([abortCtrl.signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]));
    if (!resp.ok) {
     const warn = resp.error_code === 409
      ? "telegram-bridge: Telegram 409 — another poller or webhook conflicts; backing off"
      : `telegram-bridge: getUpdates (${resp.error_code ?? ""}): ${resp.description ?? ""}`;
     for (const [sock] of clients) writeMsg(sock, { type: "warning", message: warn });
     backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
     await sleep(backoff, abortCtrl.signal);
     continue;
    }
    backoff = BACKOFF_BASE_MS;
    const updates = Array.isArray(resp.result) ? (resp.result as TgUpdate[]) : [];
    for (const u of updates) { await handleUpdate(u); offset = u.update_id + 1; }
   } catch {
    if (abortCtrl.signal.aborted) break;
    backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
    await sleep(backoff, abortCtrl.signal).catch(() => { });
   }
  }
 }

 const server: Server = createServer((sock) => {
  cancelIdle();
  let registered = false;
  readLines(
   sock,
   (line) => {
    let msg: ClientMsg;
    try { msg = JSON.parse(line) as ClientMsg; } catch { return; }
    if (!registered) {
     if (msg.type !== "hello") return;
     if (msg.chatId !== chatId) {
      writeMsg(sock, { type: "rejected", reason: `chatId mismatch — this receiver serves a different chat` });
      sock.destroy();
      return;
     }
     clients.set(sock, { clientId: msg.clientId });
     registered = true;
     writeMsg(sock, { type: "welcome", interactive: true });
     return;
    }
    switch (msg.type) {
     case "restore":
      for (const e of msg.entries) {
       msgOwners.set(e.msgId, sock); deadMsgIds.delete(e.msgId);
       for (const cid of e.chunkMsgIds) { msgOwners.set(cid, sock); deadMsgIds.delete(cid); }
       if (e.cbToken && e.details) {
        detailsMap.set(e.cbToken, { text: e.details, summaryMsgId: e.msgId, sending: false, ownerSocket: sock });
        deadTokens.delete(e.cbToken);
       }
       if (e.interaction) registerInteraction(e.msgId, e.interaction);
      }
      break;
     case "send":
      doSend(sock, msg).catch(() => { });
      break;
     case "interactive_send":
     case "interactive_edit":
      void doInteractive(sock, msg);
      break;
     case "reply_ack":
      handleReplyAck(msg);
      break;
     case "bye":
      sock.destroy();
      break;
    }
   },
   () => { if (registered) dropClient(sock); else if (clients.size === 0) startIdle(); },
  );
 });

 const dir = socketPath.slice(0, socketPath.lastIndexOf("/"));
 await mkdir(dir, { recursive: true, mode: 0o700 });

 await new Promise<void>((resolve, reject) => {
  const onBindErr = async (err: NodeJS.ErrnoException, retry: boolean): Promise<void> => {
   if (err.code !== "EADDRINUSE" && err.code !== "EEXIST") { reject(err); return; }
   if (retry) process.exit(0);

   if (await probeLive(socketPath)) process.exit(0);

   // Conservative: if the socket was created recently, another spawner is still starting up.
   // Never unlink a fresh socket after a failed probe — retry connecting instead.
   const st = await stat(socketPath).catch(() => null);
   if (st && Date.now() - st.mtimeMs < NEW_SOCKET_AGE_MS) {
    const until = Date.now() + 3_000;
    while (Date.now() < until) {
     await sleep(300);
     if (await probeLive(socketPath)) process.exit(0);
    }
   }

   // Inode guard: re-stat before unlinking; if it changed another process won the race
   const st2 = await stat(socketPath).catch(() => null);
   if (st2 && st && st2.ino !== st.ino) {
    if (await probeLive(socketPath)) process.exit(0);
   }

   await unlink(socketPath).catch(() => { });
   server.once("listening", resolve);
   server.once("error", (e) => void onBindErr(e as NodeJS.ErrnoException, true));
   server.listen(socketPath);
  };
  server.once("listening", resolve);
  server.once("error", (e) => void onBindErr(e as NodeJS.ErrnoException, false));
  server.listen(socketPath);
 });

 server.removeAllListeners("error");
 server.on("error", (err) => { process.stderr.write(`telegram-bridge receiver: ${err}\n`); });

 const onShutdown = (): void => {
  abortCtrl.abort();
  server.close(() => unlink(socketPath).catch(() => { }).finally(() => process.exit(0)));
 };
 process.once("SIGTERM", onShutdown);
 process.once("SIGINT", onShutdown);

 // Start idle timer immediately — receiver exits if no client connects within IDLE_GRACE_MS
 startIdle();

 poll().catch((err) => { process.stderr.write(`telegram-bridge receiver poll: ${sanitizeErr(err)}\n`); });
}

// ── Entry point (receiver mode) ───────────────────────────────────────────────

// Double-guard: argv[2]==="receiver" alone is insufficient — Pi might pass positional args that
// match. Also verify argv[1] resolves to this file so module imports never trigger the daemon.
if (process.argv[2] === "receiver" && resolve(process.argv[1] ?? "") === resolve(THIS_FILE)) {
 const [, , , socketPath, chatId] = process.argv;
 const token = process.env["TELEGRAM_TOKEN"];
 if (!socketPath || !chatId || !token) {
  process.stderr.write(
   "usage: node --experimental-strip-types telegram-bridge.ts receiver <socketPath> <chatId>\n" +
   "env: TELEGRAM_TOKEN required\n",
  );
  process.exit(1);
 }
 runReceiver(socketPath, chatId, token).catch((err) => {
  process.stderr.write(`telegram-bridge receiver error: ${sanitizeErr(err)}\n`);
  process.exit(1);
 });
}
