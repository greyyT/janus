import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseEnv } from "node:util";
import { uuidv7 } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  createTelegramBridge,
  type TelegramBridge,
} from "./lib/telegram-bridge.ts";
import {
  TelegramQuestionnaire,
  type QuestionnaireState,
} from "./lib/telegram-questionnaire.ts";

const TLDR_MODELS = [
  ["claude-bridge", "claude-haiku-4-5"],
  ["openai-codex", "gpt-6-luna"],
  ["openai-api-key", "gpt-6-luna"],
] as const;
const TLDR_TIMEOUT_MS = 20_000;
const FALLBACK_LENGTH = 200;
// Settings come from `.env` next to this file (gitignored); the environment
// overrides it. Without either, the extension loads and warns when it would send.
const ENV_FILE = new URL(".env", import.meta.url);
const {
  JANUS_TELEGRAM_BOT_TOKEN = "",
  JANUS_TELEGRAM_CHAT_ID = "",
} = {
  ...(existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, "utf8")) : {}),
  ...process.env,
};

const TLDR_PROMPT = [
  "You write phone notifications about a coding agent's finished run.",
  "Given the user's request and the agent's final reply, output exactly two lines, plain text. Wrap file names, commands, and code identifiers in backticks; no other markdown:",
  "Done: <what the agent did or found, past tense, max 12 words>",
  "Next: <the action the agent asks the user to take, max 12 words, or 'none'>",
].join("\n");

type Block = { type: string; text?: string };
type MessageLike = {
  role: string;
  content: string | Block[];
  stopReason?: string;
  errorMessage?: string;
};

function textOf(content: string | Block[]): string {
  if (typeof content === "string") return content.trim();
  return content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function lastMessage(
  ctx: ExtensionContext,
  role: "user" | "assistant",
): MessageLike | undefined {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type === "message" && entry.message.role === role) {
      return entry.message as MessageLike;
    }
  }
  return undefined;
}

function sessionLabel(ctx: ExtensionContext): string {
  return ctx.sessionManager.getSessionName() ?? basename(ctx.cwd);
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return minutes < 1 ? `${Math.round(ms / 1000)}s` : `${minutes}m`;
}

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim()) ?? "";
  return line.length > FALLBACK_LENGTH
    ? `${line.slice(0, FALLBACK_LENGTH)}…`
    : line;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineHtml(text: string): string {
  return escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function formatSummary(summary: string): string {
  const lines = summary.split("\n").filter((line) => line.trim());
  const formatted = lines.flatMap((line) => {
    const match = line.match(/^\s*(Done|Next):\s*(.*)$/i);
    if (!match) return [inlineHtml(line)];
    const [, label, value] = match;
    if (/^none\.?$/i.test(value.trim())) return [];
    return [
      `<b>${label[0].toUpperCase()}${label.slice(1).toLowerCase()}:</b> ${inlineHtml(value)}`,
    ];
  });
  return formatted.join("\n");
}

async function tldr(
  ctx: ExtensionContext,
  request: string,
  reply: string,
): Promise<string> {
  const context = {
    systemPrompt: TLDR_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `<request>\n${request}\n</request>\n<reply>\n${reply}\n</reply>`,
          },
        ],
        timestamp: Date.now(),
      },
    ],
  };
  for (const [provider, id] of TLDR_MODELS) {
    const model = ctx.modelRegistry.find(provider, id);
    if (!model || !ctx.modelRegistry.hasConfiguredAuth(model)) continue;
    try {
      const response = await ctx.modelRegistry.complete(model, context, {
        cacheRetention: "none",
        sessionId: uuidv7(),
        reasoningEffort: "none",
        signal: AbortSignal.timeout(TLDR_TIMEOUT_MS),
      });
      const text = textOf(response.content);
      if (response.stopReason !== "error" && text) return text;
    } catch {
      // Try the next model.
    }
  }
  return firstLine(reply);
}

export default function notifyUserExtension(pi: ExtensionAPI) {
  let runStartedAt: number | undefined;
  let bridge: TelegramBridge | undefined;
  let questionnaire: TelegramQuestionnaire | undefined;

  pi.events.on("questionnaire:state", (data) => {
    questionnaire?.update(data as QuestionnaireState);
  });

  async function sendTelegram(
    ctx: ExtensionContext,
    text: string,
    details?: string,
  ) {
    if (!bridge) {
      ctx.ui.notify(
        "notify-user: missing JANUS_TELEGRAM_BOT_TOKEN or JANUS_TELEGRAM_CHAT_ID",
        "warning",
      );
      return;
    }
    try {
      await bridge.send(text, { details });
    } catch (error) {
      ctx.ui.notify(`notify-user: ${String(error)}`, "warning");
    }
  }

  async function startSession(_event: unknown, ctx: ExtensionContext) {
    const previousBridge = bridge;
    bridge = undefined;
    await questionnaire?.close();
    questionnaire = undefined;
    previousBridge?.close();
    runStartedAt = undefined;
    if (!JANUS_TELEGRAM_BOT_TOKEN || !JANUS_TELEGRAM_CHAT_ID) return;

    const sessionId = ctx.sessionManager.getSessionId();
    const currentBridge = createTelegramBridge({
      token: JANUS_TELEGRAM_BOT_TOKEN,
      chatId: JANUS_TELEGRAM_CHAT_ID,
      onReply: (text) => {
        if (
          bridge !== currentBridge ||
          ctx.sessionManager.getSessionId() !== sessionId
        ) {
          throw new Error("The originating session is no longer available.");
        }
        pi.sendUserMessage(text, {
          deliverAs: "followUp",
          expandPromptTemplates: false,
        });
      },
      onAction: (action, text) => {
        if (
          bridge !== currentBridge ||
          ctx.sessionManager.getSessionId() !== sessionId ||
          !questionnaire
        ) {
          throw new Error("The originating session is no longer available.");
        }
        return questionnaire.answer(action, text);
      },
      onWarning: (message) =>
        ctx.ui.notify(`notify-user: ${message}`, "warning"),
    });
    bridge = currentBridge;
    questionnaire = new TelegramQuestionnaire(
      pi, currentBridge, sessionId, sessionLabel(ctx),
      (message) => ctx.ui.notify(`notify-user: ${message}`, "warning"),
    );
  }

  pi.on("session_start", startSession);

  pi.on("session_shutdown", async () => {
    const previousBridge = bridge;
    bridge = undefined;
    await questionnaire?.close();
    questionnaire = undefined;
    previousBridge?.close();
    runStartedAt = undefined;
  });

  pi.on("agent_start", async () => {
    runStartedAt ??= Date.now();
  });

  pi.on("agent_settled", async (_event, ctx) => {
    const duration = runStartedAt ? Date.now() - runStartedAt : 0;
    runStartedAt = undefined;

    const message = lastMessage(ctx, "assistant");
    if (!message || message.stopReason === "aborted") return;

    const label = escapeHtml(sessionLabel(ctx));
    if (message.stopReason === "error") {
      const error = firstLine(message.errorMessage ?? "Unknown error");
      void sendTelegram(
        ctx,
        `⚠️ <b>${label}</b> failed\n\n<code>${escapeHtml(error)}</code>`,
      );
      return;
    }

    const header = `✅ <b>${label}</b> done in ${formatDuration(duration)}`;
    const contextUsage = ctx.getContextUsage();
    const contextLine = contextUsage
      ? `<b>Context:</b> ${contextUsage.percent?.toFixed(1) ?? "?"}%/${Math.round(contextUsage.contextWindow / 1000)}K`
      : "<b>Context:</b> unavailable";
    const request = textOf(lastMessage(ctx, "user")?.content ?? "");
    const reply = textOf(message.content);
    const currentBridge = bridge;
    void tldr(ctx, request, reply)
      .then((summary) => {
        if (bridge !== currentBridge) return;
        return sendTelegram(
          ctx,
          `${header}\n\n${formatSummary(summary)}\n\n${contextLine}`,
          reply,
        );
      })
      .catch((error) => {
        ctx.ui.notify(`notify-user: ${String(error)}`, "warning");
      });
  });
}
