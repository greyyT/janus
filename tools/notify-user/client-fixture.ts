/**
 * Standalone child-process fixture for telegram-bridge integration tests.
 * Launch: node --experimental-strip-types tools/notify-user/client-fixture.ts
 *
 * Required env: BRIDGE_TOKEN, BRIDGE_CHAT_ID, TELEGRAM_API_BASE, TELEGRAM_SOCKET_DIR
 * Optional env: TELEGRAM_IDLE_GRACE_MS
 * Stdin:  newline-delimited JSON commands  { cmd, text?, details? }
 * Stdout: newline-delimited JSON events    { type, ...fields }
 *
 * Variable-path dynamic import avoids TS static resolution of the .ts extension
 * while Node's --experimental-strip-types loader resolves it correctly at runtime.
 */
import { createInterface } from "node:readline";

// Structural types — no static import needed.
interface TelegramBridge {
 send(text: string, opts?: { details?: string }): Promise<void>;
 sendInteractive(text: string, opts: { replyAction?: string; buttons: { text: string; action: string }[][] }): Promise<number>;
 editInteractive(msgId: number, text: string, buttons: { text: string; action: string }[][]): Promise<void>;
 close(): void;
}
type BridgeModule = {
 createTelegramBridge(opts: {
  token: string;
  chatId: string;
  onReply(text: string): void | Promise<void>;
  onAction(action: string, text?: string): void | Promise<void>;
  onWarning(message: string): void;
 }): TelegramBridge;
};

function emit(ev: object): void {
 process.stdout.write(JSON.stringify(ev) + "\n");
}

const bridgeMod = await import(
 new URL("../../.pi/extensions/lib/telegram-bridge.ts", import.meta.url).pathname
) as BridgeModule;

let holdReplies = false;
let pendingReply: { resolve(): void; reject(error: Error): void } | undefined;

const bridge = bridgeMod.createTelegramBridge({
 token: process.env.BRIDGE_TOKEN ?? "",
 chatId: process.env.BRIDGE_CHAT_ID ?? "",
 onReply: (text) => {
  if (!holdReplies) return emit({ type: "reply", text });
  return new Promise<void>((resolve, reject) => {
   pendingReply = { resolve, reject };
   emit({ type: "reply", text });
  });
 },
 onAction: (action, text) => {
  emit({ type: "action", action, ...(text !== undefined ? { text } : {}) });
  if (holdReplies) return new Promise<void>((resolve, reject) => { pendingReply = { resolve, reject }; });
 },
 onWarning: (message) => emit({ type: "warning", message }),
});

emit({ type: "ready" });

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", async (line) => {
 if (!line.trim()) return;
 const cmd = JSON.parse(line) as {
  cmd: string; text?: string; details?: string; msgId?: number; replyAction?: string;
  buttons?: { text: string; action: string }[][];
 };
 try {
  switch (cmd.cmd) {
   case "send":
    await bridge.send(
     cmd.text!,
     cmd.details !== undefined ? { details: cmd.details } : undefined,
    );
    emit({ type: "sent" });
    break;
   case "sendInteractive": {
    const msgId = await bridge.sendInteractive(cmd.text!, { replyAction: cmd.replyAction, buttons: cmd.buttons ?? [] });
    emit({ type: "interactiveSent", msgId });
    break;
   }
   case "editInteractive":
    await bridge.editInteractive(cmd.msgId!, cmd.text!, cmd.buttons ?? []);
    emit({ type: "edited" });
    break;
   case "holdReplies":
    holdReplies = true;
    emit({ type: "holdingReplies" });
    break;
   case "acceptReply":
    pendingReply?.resolve();
    pendingReply = undefined;
    break;
   case "rejectReply":
    pendingReply?.reject(new Error("The originating session is no longer available."));
    pendingReply = undefined;
    break;
   case "close":
    bridge.close();
    emit({ type: "closed" });
    rl.close();
    break;
   case "ping":
    emit({ type: "pong" });
    break;
  }
 } catch (err) {
  emit({ type: "error", message: String(err) });
 }
});
