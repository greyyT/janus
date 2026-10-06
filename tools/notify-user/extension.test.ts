/**
 * Unit tests for the notify-user extension's Pi lifecycle handlers.
 * Mocks telegram-bridge.ts and @earendil-works/pi-ai; no real HTTP or processes.
 *
 * Covers:
 *  - stale-closure guard: onReply throws after bridge is replaced
 *  - followUp delivery: onReply invokes pi.sendUserMessage with correct options
 *  - details snapshot: sendTelegram not called when bridge replaced before tldr resolves
 *  - session_shutdown: bridge.close() called and bridge cleared
 */
import { beforeAll, beforeEach, afterAll, describe, expect, test, vi } from "vitest";
import { EventEmitter } from "node:events";

// Must be hoisted before any imports that trigger the real modules.
vi.mock("../../.pi/extensions/lib/telegram-bridge.ts", () => ({
 createTelegramBridge: vi.fn(),
}));
vi.mock("@earendil-works/pi-ai", () => ({
 uuidv7: vi.fn(() => "00000000-0000-0000-0000-000000000000"),
}));

let notifyUserExtension: (pi: MockPi) => void;
let mockCreateBridge: ReturnType<typeof vi.fn>;

beforeAll(async () => {
 vi.stubEnv("JANUS_TELEGRAM_BOT_TOKEN", "ext-test-token");
 vi.stubEnv("JANUS_TELEGRAM_CHAT_ID", "12345");
 vi.resetModules();
 const extensionPath = new URL("../../.pi/extensions/notify-user.ts", import.meta.url).href;
 const mod = await import(extensionPath) as { default: typeof notifyUserExtension };
 notifyUserExtension = mod.default;
 const bridgePath = new URL("../../.pi/extensions/lib/telegram-bridge.ts", import.meta.url).href;
 const bridgeMod = await import(bridgePath);
 mockCreateBridge = bridgeMod.createTelegramBridge as ReturnType<typeof vi.fn>;
});

afterAll(() => {
 vi.unstubAllEnvs();
});

// ─── per-test helpers ─────────────────────────────────────────────────────────

interface MockBridge {
 send: ReturnType<typeof vi.fn>;
 sendInteractive: ReturnType<typeof vi.fn>;
 editInteractive: ReturnType<typeof vi.fn>;
 close: ReturnType<typeof vi.fn>;
}

function makeBridge(): MockBridge {
 let nextId = 1;
 return {
  send: vi.fn().mockResolvedValue(undefined), close: vi.fn(),
  sendInteractive: vi.fn().mockImplementation(async () => nextId++),
  editInteractive: vi.fn().mockResolvedValue(undefined),
 };
}

type Handler = (event: Record<string, unknown>, ctx: MockCtx) => Promise<void>;

interface MockPi {
 on(event: string, handler: Handler): void;
 sendUserMessage: ReturnType<typeof vi.fn>;
 events: {
  on(channel: string, handler: (data: unknown) => void): () => void;
  emit(channel: string, data: unknown): void;
 };
}

interface MockCtx {
 sessionManager: {
  getSessionName: ReturnType<typeof vi.fn>;
  getSessionId: ReturnType<typeof vi.fn>;
  getBranch: ReturnType<typeof vi.fn>;
 };
 ui: { notify: ReturnType<typeof vi.fn> };
 modelRegistry: {
  find: ReturnType<typeof vi.fn>;
  hasConfiguredAuth: ReturnType<typeof vi.fn>;
  complete: ReturnType<typeof vi.fn>;
 };
 cwd: string;
 getContextUsage: ReturnType<typeof vi.fn>;
}

function createHarness() {
 const handlerMap = new Map<string, Handler[]>();
 const events = new EventEmitter();

 const pi: MockPi = {
  on(event, handler) {
   const list = handlerMap.get(event) ?? [];
   list.push(handler);
   handlerMap.set(event, list);
  },
  sendUserMessage: vi.fn(),
  events: {
   on(channel, handler) { events.on(channel, handler); return () => { events.off(channel, handler); }; },
   emit(channel, data) { events.emit(channel, data); },
  },
 };

 const ctx: MockCtx = {
  sessionManager: {
   getSessionName: vi.fn(() => "test-session"),
   getSessionId: vi.fn(() => "sid-alpha"),
   getBranch: vi.fn(() => []),
  },
  ui: { notify: vi.fn() },
  modelRegistry: {
   find: vi.fn(() => undefined),
   hasConfiguredAuth: vi.fn(() => false),
   complete: vi.fn(),
  },
  cwd: "/home/test",
  getContextUsage: vi.fn(() => undefined),
 };

 async function emit(event: string, arg: Record<string, unknown> = {}): Promise<void> {
  for (const h of handlerMap.get(event) ?? []) {
   await h(arg, ctx);
  }
 }

 return { pi, ctx, emit };
}

beforeEach(() => {
 vi.clearAllMocks();
 // Default: each createTelegramBridge call returns a fresh mock bridge.
 mockCreateBridge.mockImplementation(() => makeBridge());
});

// ─── tests ────────────────────────────────────────────────────────────────────

describe("notify-user extension", () => {
 test("onReply delivers text via sendUserMessage as a followUp", async () => {
  const { pi, emit } = createHarness();
  notifyUserExtension(pi as unknown as Parameters<typeof notifyUserExtension>[0]);

  await emit("session_start");

  const { onReply } = mockCreateBridge.mock.calls[0][0] as { onReply(text: string): void };
  onReply("what should I do next?");

  expect(pi.sendUserMessage).toHaveBeenCalledOnce();
  expect(pi.sendUserMessage).toHaveBeenCalledWith("what should I do next?", {
   deliverAs: "followUp",
   expandPromptTemplates: false,
  });
 });

 test("onReply throws after session_start replaces the bridge (stale closure)", async () => {
  const { pi, emit } = createHarness();
  notifyUserExtension(pi as unknown as Parameters<typeof notifyUserExtension>[0]);

  await emit("session_start"); // session A — captures onReplyA
  const { onReply: onReplyA } = mockCreateBridge.mock.calls[0][0] as { onReply(text: string): void };

  // A's onReply still works before replacement.
  expect(() => onReplyA("hello")).not.toThrow();
  expect(pi.sendUserMessage).toHaveBeenCalledOnce();
  pi.sendUserMessage.mockClear();

  await emit("session_start"); // session B — replaces bridge

  // A's closure is now stale; onReply must throw and not deliver.
  expect(() => onReplyA("stale message")).toThrow();
  expect(pi.sendUserMessage).not.toHaveBeenCalled();
 });

 test("session_shutdown closes bridge and prevents further delivery", async () => {
  const { pi, emit } = createHarness();
  notifyUserExtension(pi as unknown as Parameters<typeof notifyUserExtension>[0]);

  const bridge = makeBridge();
  mockCreateBridge.mockReturnValueOnce(bridge);

  await emit("session_start");
  await emit("session_shutdown");

  expect(bridge.close).toHaveBeenCalledOnce();

  // After shutdown, session_start's bridge check clears onReply's closure;
  // a subsequent session_start must create a fresh bridge.
  await emit("session_start");
  expect(mockCreateBridge).toHaveBeenCalledTimes(2);
 });

 test("details snapshot: sendTelegram skipped if bridge replaced before tldr resolves", async () => {
  const { pi, ctx, emit } = createHarness();
  notifyUserExtension(pi as unknown as Parameters<typeof notifyUserExtension>[0]);

  const bridgeA = makeBridge();
  mockCreateBridge.mockReturnValueOnce(bridgeA);

  // Provide a real-looking model so tldr does NOT fall back to firstLine immediately.
  let resolveComplete!: (result: unknown) => void;
  const pendingComplete = new Promise<unknown>((r) => { resolveComplete = r; });
  ctx.modelRegistry.find.mockReturnValue({ id: "mock-model", provider: "mock" });
  ctx.modelRegistry.hasConfiguredAuth.mockReturnValue(true);
  ctx.modelRegistry.complete.mockReturnValue(pendingComplete);

  // Provide a branch with one user + one assistant message.
  ctx.sessionManager.getBranch.mockReturnValue([
   { type: "message", message: { role: "user", content: "do the thing", timestamp: Date.now() } },
   {
    type: "message",
    message: {
     role: "assistant",
     content: [{ type: "text", text: "Done! Result here." }],
     stopReason: "end_turn",
    },
   },
  ]);

  await emit("session_start");
  await emit("agent_start");
  // agent_settled fires; captures currentBridge = bridgeA, starts tldr (pending).
  void emit("agent_settled");

  // Replace bridge before tldr resolves.
  await emit("session_start"); // bridge = bridgeB

  // Now resolve tldr — sendTelegram should be skipped (bridge !== currentBridge).
  resolveComplete({
   content: [{ type: "text", text: "Done: finished the thing\nNext: review output" }],
   stopReason: "end_turn",
  });

  // Flush promises and microtasks.
  await new Promise<void>((r) => setTimeout(r, 20));

  expect(bridgeA.send).not.toHaveBeenCalled();
 });

 test.each([
  [{ tokens: 55760, contextWindow: 272000, percent: 20.5 }, "20.5%/272K"],
  [{ tokens: 0, contextWindow: 272000, percent: 0 }, "0.0%/272K"],
  [{ tokens: null, contextWindow: 272000, percent: null }, "?%/272K"],
  [undefined, "unavailable"],
 ])("sends summary, details, and context usage %j", async (usage, expectedContext) => {
  const { pi, ctx, emit } = createHarness();
  notifyUserExtension(pi as unknown as Parameters<typeof notifyUserExtension>[0]);

  const bridge = makeBridge();
  mockCreateBridge.mockReturnValueOnce(bridge);

  const replyText = "All done, no issues.";
  ctx.getContextUsage.mockReturnValue(usage);
  ctx.sessionManager.getBranch.mockReturnValue([
   { type: "message", message: { role: "user", content: "run deploy", timestamp: Date.now() } },
   {
    type: "message",
    message: {
     role: "assistant",
     content: [{ type: "text", text: replyText }],
     stopReason: "end_turn",
    },
   },
  ]);

  // No model available → tldr falls back to firstLine immediately.
  ctx.modelRegistry.find.mockReturnValue(undefined);

  await emit("session_start");
  await emit("agent_start");
  await emit("agent_settled");

  // Flush async chain.
  await new Promise<void>((r) => setTimeout(r, 20));

  expect(bridge.send).toHaveBeenCalledOnce();
  const [text, opts] = bridge.send.mock.calls[0] as [string, { details?: string }];
  expect(text).toContain(`<b>Context:</b> ${expectedContext}`);
  // Details must be the full original reply text.
  expect(opts?.details).toBe(replyText);
 });

 test("ready questionnaires send separate numbered question cards and a progress summary", async () => {
  const { pi, emit } = createHarness();
  notifyUserExtension(pi as unknown as Parameters<typeof notifyUserExtension>[0]);
  const bridge = makeBridge();
  mockCreateBridge.mockReturnValueOnce(bridge);
  await emit("session_start");
  pi.events.emit("questionnaire:state", {
   toolCallId: "ask-1", sessionId: "sid-alpha", status: "open", answers: [],
   questions: [
    { id: "approach", label: "Approach", prompt: "Which approach?", allowOther: true, options: [{ value: "simple", label: "Simple", description: "Fewer moving parts" }] },
    { id: "blockers", label: "Blockers", prompt: "Any blockers?", allowOther: false, options: [{ value: "no", label: "None" }] },
   ],
  });
  await vi.waitFor(() => expect(bridge.sendInteractive).toHaveBeenCalledTimes(3));
  const [text, opts] = bridge.sendInteractive.mock.calls[0];
  expect(text).toContain("Question 1/2");
  expect(text).toContain("1. Simple");
  expect(text).toContain("Fewer moving parts");
  expect(text).toContain("reply to this question");
  expect(opts.buttons[0][0].text).toBe("1");
  expect(bridge.send).not.toHaveBeenCalled();
  expect(pi.sendUserMessage).not.toHaveBeenCalled();
 });

 test("error notification sent without details", async () => {
  const { pi, ctx, emit } = createHarness();
  notifyUserExtension(pi as unknown as Parameters<typeof notifyUserExtension>[0]);

  const bridge = makeBridge();
  mockCreateBridge.mockReturnValueOnce(bridge);

  ctx.sessionManager.getBranch.mockReturnValue([
   {
    type: "message",
    message: {
     role: "assistant",
     content: [],
     stopReason: "error",
     errorMessage: "Tool call failed: timeout",
    },
   },
  ]);

  await emit("session_start");
  await emit("agent_start");
  await emit("agent_settled");

  await new Promise<void>((r) => setTimeout(r, 10));

  expect(bridge.send).toHaveBeenCalledOnce();
  const [text, opts] = bridge.send.mock.calls[0] as [string, { details?: string } | undefined];
  expect(text).toContain("failed");
  expect(text).toContain("timeout");
  expect(opts?.details).toBeUndefined();
 });

 test("onWarning forwards to ctx.ui.notify with warning severity", async () => {
  const { pi, ctx, emit } = createHarness();
  notifyUserExtension(pi as unknown as Parameters<typeof notifyUserExtension>[0]);

  await emit("session_start");
  const { onWarning } = mockCreateBridge.mock.calls[0][0] as { onWarning(msg: string): void };

  onWarning("receiver 409 conflict");

  expect(ctx.ui.notify).toHaveBeenCalledWith(
   expect.stringContaining("receiver 409 conflict"),
   "warning",
  );
 });

 test("non-ask tool_execution_start does not trigger send", async () => {
  const { pi, emit } = createHarness();
  notifyUserExtension(pi as unknown as Parameters<typeof notifyUserExtension>[0]);

  const bridge = makeBridge();
  mockCreateBridge.mockReturnValueOnce(bridge);

  await emit("session_start");
  await emit("tool_execution_start", { toolName: "bash", args: {} });
  await new Promise<void>((r) => setTimeout(r, 10));

  expect(bridge.send).not.toHaveBeenCalled();
 });

 test("agent_settled with aborted stop reason sends no notification", async () => {
  const { pi, ctx, emit } = createHarness();
  notifyUserExtension(pi as unknown as Parameters<typeof notifyUserExtension>[0]);

  const bridge = makeBridge();
  mockCreateBridge.mockReturnValueOnce(bridge);

  ctx.sessionManager.getBranch.mockReturnValue([
   {
    type: "message",
    message: {
     role: "assistant",
     content: [{ type: "text", text: "interrupted" }],
     stopReason: "aborted",
    },
   },
  ]);

  await emit("session_start");
  await emit("agent_start");
  await emit("agent_settled");
  await new Promise<void>((r) => setTimeout(r, 10));

  expect(bridge.send).not.toHaveBeenCalled();
 });
});
