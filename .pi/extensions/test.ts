/**
 * Markdown Export Extension
 *
 * Adds a `/mdexport` command that exports the current session to a Markdown file.
 *
 * Usage:
 *   /mdexport              - Export to auto-named file in cwd
 *   /mdexport output.md    - Export to specific path
 *
 * The exported markdown includes:
 * - Session metadata (model, timestamp)
 * - User messages with text and images
 * - Assistant messages with text and tool calls (thinking blocks are omitted)
 * - Tool results (collapsed for long output)
 * - Compaction and branch summaries
 * - Bash executions (! commands)
 * - Custom extension messages
 * - Model and thinking level changes
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type {
  AssistantMessage,
  ImageContent,
  TextContent,
  ToolResultMessage,
  UserMessage,
} from "@mariozechner/pi-ai";
import type {
  BranchSummaryEntry,
  CompactionEntry,
  CustomMessageEntry,
  ExtensionAPI,
  ExtensionCommandContext,
  ModelChangeEntry,
  SessionEntry,
  SessionHeader,
  SessionMessageEntry,
  ThinkingLevelChangeEntry,
} from "@mariozechner/pi-coding-agent";
// LabelEntry and CustomEntry are not exported, but handled via default.

import * as fs from "node:fs";
import * as path from "node:path";

// -- Helpers ------------------------------------------------------------------

function formatTimestamp(ts: string | number): string {
  const date = new Date(ts);
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");
}

function textFromContent(
  content: (TextContent | ImageContent)[] | string,
): string {
  if (typeof content === "string") {
    return content;
  }
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "text") {
      parts.push(block.text);
    } else if (block.type === "image") {
      if ("url" in block && typeof block.url === "string") {
        parts.push(`![image](${block.url})`);
      } else {
        parts.push("*[embedded image]*");
      }
    }
  }
  return parts.join("\n");
}

/** Wrap text in a fenced code block. */
function wrapOutput(text: string, lang: string = ""): string {
  return [`\`\`\`${lang}`, text, "```"].join("\n");
}

function renderSummaryBlock(label: string, summary: string): string {
  const quoted = summary.split("\n").join("\n> ");
  return `*${label}:*\n\n> ${quoted}\n`;
}

// -- Assistant content block renderers ----------------------------------------

function renderAssistantContentBlock(
  block: AssistantMessage["content"][number],
): string {
  switch (block.type) {
    case "text":
      return block.text;
    case "thinking":
      return "";
    case "toolCall": {
      const args =
        typeof block.arguments === "string"
          ? block.arguments
          : JSON.stringify(block.arguments, null, 2);
      return [
        `**Tool Call: \`${block.name}\`**\n`,
        "```json",
        args,
        "```",
        "",
      ].join("\n");
    }
    default: {
      const _exhaustive: never = block;
      throw new Error(
        `Unknown assistant content block type: ${(_exhaustive as any).type}`,
      );
    }
  }
}

// -- Message renderers --------------------------------------------------------

function renderUserMessage(msg: UserMessage): string {
  const text = textFromContent(msg.content);
  if (text.length === 0) {
    return "";
  }
  return `**User:**\n\n${text}\n`;
}

function renderAssistantMessage(msg: AssistantMessage): string {
  const parts: string[] = ["**Assistant:**\n"];
  for (const block of msg.content) {
    const rendered = renderAssistantContentBlock(block);
    if (rendered.length > 0) {
      parts.push(rendered);
    }
  }
  return parts.join("\n") + "\n";
}

function renderToolResult(msg: ToolResultMessage): string {
  const label = msg.isError
    ? `**Tool Result: \`${msg.toolName}\` (error)**\n`
    : `**Tool Result: \`${msg.toolName}\`**\n`;

  const text = textFromContent(msg.content);
  if (text.length === 0) {
    return label + "\n";
  }
  return label + "\n" + wrapOutput(text) + "\n";
}

/**
 * Render an AgentMessage to markdown.
 *
 * The switch is exhaustive over the `role` discriminant. If pi-coding-agent adds
 * a new custom role via declaration merging, TypeScript will report a compile
 * error on the `_exhaustive: never` assignment, forcing this extension to be
 * updated.
 */
function renderMessage(msg: AgentMessage): string {
  switch (msg.role) {
    case "user":
      return renderUserMessage(msg);
    case "assistant":
      return renderAssistantMessage(msg);
    case "toolResult":
      return renderToolResult(msg);
    case "bashExecution": {
      if (msg.excludeFromContext) {
        return "";
      }
      const lines: string[] = [
        "**Bash Execution:**\n",
        "```bash",
        msg.command,
        "```",
        "",
      ];
      if (msg.output.length > 0) {
        lines.push(wrapOutput(msg.output));
      } else {
        lines.push("*(no output)*");
      }
      if (msg.cancelled) {
        lines.push("", "*(command cancelled)*");
      } else if (msg.exitCode !== undefined && msg.exitCode !== 0) {
        lines.push("", `*Exit code: ${msg.exitCode}*`);
      }
      lines.push("");
      return lines.join("\n");
    }
    case "custom": {
      if (!msg.display) {
        return "";
      }
      const text = textFromContent(msg.content);
      if (text.length === 0) {
        return "";
      }
      return `**${msg.customType || "Extension Message"}:**\n\n${text}\n`;
    }
    case "branchSummary":
      return renderSummaryBlock("Branch summary", msg.summary);
    case "compactionSummary":
      return renderSummaryBlock("Context compacted", msg.summary);
    default: {
      const _exhaustive: never = msg;
      throw new Error(`Unknown message role: ${(_exhaustive as any).role}`);
    }
  }
}

// -- Entry rendering ----------------------------------------------------------

/**
 * Render a SessionEntry to markdown.
 *
 * Exhaustive over the `type` discriminant. New entry types added to the
 * SessionEntry union will cause a compile error here.
 */
function renderEntry(entry: SessionEntry): string {
  switch (entry.type) {
    case "message":
      return renderMessage((entry as SessionMessageEntry).message);
    case "compaction":
      return renderSummaryBlock(
        "Context compacted",
        (entry as CompactionEntry).summary,
      );
    case "branch_summary":
      return renderSummaryBlock(
        "Branch summary",
        (entry as BranchSummaryEntry).summary,
      );
    case "custom_message": {
      const cme = entry as CustomMessageEntry;
      if (!cme.display) {
        return "";
      }
      const text = textFromContent(cme.content);
      if (text.length === 0) {
        return "";
      }
      return `**${cme.customType || "Extension Message"}:**\n\n${text}\n`;
    }
    case "model_change": {
      const mc = entry as ModelChangeEntry;
      return `*Switched to model: ${mc.provider}/${mc.modelId}*\n\n`;
    }
    case "thinking_level_change": {
      const tlc = entry as ThinkingLevelChangeEntry;
      return `*Thinking level changed to: ${tlc.thinkingLevel}*\n\n`;
    }
    case "custom":
      // Extension state entries; not user-visible.
      return "";
    case "label":
      // Bookmark metadata; not user-visible.
      return "";
    case "session_info":
      // Session metadata; captured in the header.
      return "";
    default: {
      const _exhaustive: never = entry;
      throw new Error(
        `Unknown session entry type: ${(_exhaustive as any).type}`,
      );
    }
  }
}

// -- Export logic -------------------------------------------------------------

function buildMarkdown(
  header: SessionHeader,
  branch: SessionEntry[],
  sessionName: string | undefined,
  modelName: string | undefined,
): string {
  const lines: string[] = [];

  if (sessionName !== undefined) {
    lines.push(`# ${sessionName}\n`);
  } else {
    lines.push("# Session Export\n");
  }

  lines.push(
    `- **Date**: ${formatTimestamp(header.timestamp)}`,
    `- **Working Directory**: \`${header.cwd}\``,
  );
  if (modelName !== undefined) {
    lines.push(`- **Model**: ${modelName}`);
  }
  lines.push("");

  let first = true;
  for (const entry of branch) {
    const rendered = renderEntry(entry);
    if (rendered.length > 0) {
      if (!first) {
        lines.push("---\n");
      }
      first = false;
      lines.push(rendered);
    }
  }

  return lines.join("\n");
}

// -- Extension entry point ----------------------------------------------------

export default function exportMarkdownExtension(pi: ExtensionAPI) {
  pi.registerCommand("mdexport", {
    description: "Export session to Markdown file",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const sm = ctx.sessionManager;
      const sessionFile = sm.getSessionFile();

      if (sessionFile === undefined) {
        ctx.ui.notify(
          "Nothing to export - start a conversation first",
          "error",
        );
        return;
      }

      const header = sm.getHeader();
      if (header === null) {
        ctx.ui.notify("Nothing to export - session has no header", "error");
        return;
      }

      const branch = sm.getBranch();
      const sessionName = sm.getSessionName();
      const modelName = ctx.model?.name;

      const markdown = buildMarkdown(header, branch, sessionName, modelName);

      let outputPath = args.trim();
      if (outputPath.length === 0) {
        const sessionBasename = path.basename(sessionFile, ".jsonl");
        outputPath = path.join(ctx.cwd, `pi-session-${sessionBasename}.md`);
      } else if (!path.isAbsolute(outputPath)) {
        outputPath = path.join(ctx.cwd, outputPath);
      }

      try {
        fs.writeFileSync(outputPath, markdown, "utf-8");
        ctx.ui.notify(`Session exported to: ${outputPath}`, "info");
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        ctx.ui.notify(`Failed to export: ${message}`, "error");
      }
    },
  });
}
