import { describe, expect, test } from "vitest";
import type { SessionEntry } from "./sessions.js";
import { renderTranscript } from "./transcript.js";

function message(id: string, parentId: string | null, role: string, content: unknown): SessionEntry {
  return { type: "message", id, parentId, message: { role, content } };
}

describe("renderTranscript", () => {
  test("renders turns as text and one line per tool call, without thinking or tool results", () => {
    const entries: SessionEntry[] = [
      { type: "session", id: "s" },
      message("1", null, "user", [{ type: "text", text: "hello" }]),
      message("2", "1", "assistant", [
        { type: "thinking", thinking: "private" },
        { type: "text", text: "hi" },
        { type: "toolCall", name: "read", arguments: { path: "brain/HOME.md", offset: null } },
      ]),
      message("3", "2", "toolResult", [{ type: "text", text: "file contents" }]),
      message("4", "3", "assistant", [
        { type: "toolCall", name: "bash", arguments: { command: "cat <<'EOF' > a.md\nbody\nEOF", timeout: 60 } },
        { type: "text", text: "so this is..." },
      ]),
      message("5", "4", "user", "thanks"),
    ];

    expect(renderTranscript(entries)).toBe(
      ["user:\nhello", "janus:\nhi\n[Read brain/HOME.md]\n[Bash cat <<'EOF' > a.md…]\n\nso this is...", "user:\nthanks"].join("\n\n"),
    );
  });

  test("follows the current branch and drops branches left with tree navigation", () => {
    const entries: SessionEntry[] = [
      message("1", null, "user", "first"),
      message("2", "1", "assistant", [{ type: "text", text: "abandoned answer" }]),
      message("3", "1", "assistant", [{ type: "text", text: "kept answer" }]),
    ];

    expect(renderTranscript(entries)).toBe("user:\nfirst\n\njanus:\nkept answer");
  });
});
