import type { SessionEntry } from "./sessions.js";

type Part = { kind: "text" | "tool"; value: string };
type ContentBlock = { type?: string; text?: string; name?: string; arguments?: Record<string, unknown> };

const TOOL_ARGUMENT_MAX = 120;
const PRIMARY_ARGUMENTS = ["path", "file_path", "command", "pattern", "url", "query"];

// Renders the conversation on the session's current branch: the user's turns,
// Janus's text, and one line per tool call. Thinking, tool results, and
// branches abandoned with pi's tree navigation are left out.
export function renderTranscript(entries: SessionEntry[]): string {
  const turns: { speaker: string; parts: Part[] }[] = [];
  for (const entry of currentBranch(entries)) {
    const role = entry.message?.role;
    if (entry.type !== "message" || (role !== "user" && role !== "assistant")) continue;
    const parts = messageParts(entry.message?.content);
    if (parts.length === 0) continue;
    const speaker = role === "user" ? "user" : "janus";
    const previous = turns.at(-1);
    if (previous?.speaker === speaker) previous.parts.push(...parts);
    else turns.push({ speaker, parts });
  }
  return turns.map(turn => `${turn.speaker}:\n${joinParts(turn.parts)}`).join("\n\n");
}

// pi appends every entry; the last one is the current leaf, and parentId
// links lead back to the root.
function currentBranch(entries: SessionEntry[]): SessionEntry[] {
  const byId = new Map<string, SessionEntry>();
  let leaf: SessionEntry | undefined;
  for (const entry of entries) {
    if (entry.id === undefined || entry.type === "session") continue;
    byId.set(entry.id, entry);
    leaf = entry;
  }
  const branch: SessionEntry[] = [];
  for (let entry = leaf; entry !== undefined; entry = entry.parentId ? byId.get(entry.parentId) : undefined) branch.push(entry);
  return branch.reverse();
}

function messageParts(content: unknown): Part[] {
  if (typeof content === "string") return content.trim() ? [{ kind: "text", value: content.trim() }] : [];
  if (!Array.isArray(content)) return [];
  return (content as ContentBlock[]).flatMap((block): Part[] => {
    if (block.type === "text" && block.text?.trim()) return [{ kind: "text", value: block.text.trim() }];
    if (block.type === "toolCall" && block.name) return [{ kind: "tool", value: toolLine(block.name, block.arguments ?? {}) }];
    return [];
  });
}

function toolLine(name: string, args: Record<string, unknown>): string {
  const key = PRIMARY_ARGUMENTS.find(candidate => typeof args[candidate] === "string");
  const value = key ? args[key] : Object.values(args).find(candidate => typeof candidate === "string");
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return typeof value === "string" && value.trim() ? `[${label} ${oneLine(value)}]` : `[${label}]`;
}

function oneLine(value: string): string {
  const firstLine = value.trim().split("\n")[0];
  const isCut = firstLine.length > TOOL_ARGUMENT_MAX || firstLine !== value.trim();
  return isCut ? `${firstLine.slice(0, TOOL_ARGUMENT_MAX)}…` : firstLine;
}

function joinParts(parts: Part[]): string {
  return parts.map((part, index) => (index === 0 ? "" : part.kind === "text" ? "\n\n" : "\n") + part.value).join("");
}
