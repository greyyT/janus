import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { buildDreamInput, noticedSection, type DreamPullRequest } from "./input.js";

const DAY = "2026-01-15";

function localIso(day: number, hour: number): string {
  return new Date(2026, 0, day, hour).toISOString();
}

async function createFixture(): Promise<{ root: string; sessionsDir: string }> {
  const base = await mkdtemp(path.join(os.tmpdir(), "janus-dream-input-"));
  const root = path.join(base, "janus");
  const sessionsDir = path.join(base, "sessions");
  await mkdir(path.join(root, ".janus", "dream"), { recursive: true });
  await mkdir(path.join(sessionsDir, "--janus--"), { recursive: true });
  return { root, sessionsDir };
}

function pullRequest(createdAt: string, body: string, headRefName = "dream/x"): DreamPullRequest {
  return { headRefName, url: `https://example/${createdAt}`, createdAt, state: "MERGED", body };
}

describe("noticedSection", () => {
  test("returns the Noticed, not changed section and nothing after it", () => {
    const body = "## Changes\n\n- a\n\n## Noticed, not changed\n\n- reviewed first: morning\n\n## Covered\n\n- days";
    expect(noticedSection(body)).toBe("- reviewed first: morning");
    expect(noticedSection("## Changes\n\n- a")).toBe("");
  });
});

describe("buildDreamInput", () => {
  test("gathers changes, unresolved root notes, conversations, and recent sightings", async () => {
    const { root, sessionsDir } = await createFixture();
    await writeFile(path.join(root, "AGENTS.md"), "protected", "utf8");
    await writeFile(path.join(root, "idea.md"), "an idea\n", "utf8");
    await writeFile(path.join(root, "kept.md"), "still open\n", "utf8");
    await writeFile(path.join(root, "edited.md"), "changed since kept\n", "utf8");
    const sha1 = (text: string) => createHash("sha1").update(text).digest("hex");
    await writeFile(path.join(root, ".janus", "dream", "kept"), `${sha1("still open\n")}\tkept.md\n${sha1("old")}\tedited.md\n`, "utf8");
    const lines = [
      { type: "session", id: "s", timestamp: localIso(15, 9), cwd: root },
      { type: "message", id: "1", parentId: null, timestamp: localIso(15, 9), message: { role: "user", content: "hello" } },
    ];
    await writeFile(path.join(sessionsDir, "--janus--", "s.jsonl"), lines.map(line => JSON.stringify(line)).join("\n"), "utf8");

    const input = await buildDreamInput({
      root,
      days: [DAY],
      notesDir: root,
      sessionsDir,
      changes: "abc123 janus: changes\n idea.md | 1 +",
      pullRequests: [
        pullRequest("2026-01-10T10:00:00Z", "## Noticed, not changed\n\n- recent sighting"),
        pullRequest("2025-11-01T10:00:00Z", "## Noticed, not changed\n\n- too old"),
        pullRequest("2026-01-12T10:00:00Z", "## Noticed, not changed\n\n- not a dream", "feature/x"),
      ],
    });

    expect(input).toContain("abc123 janus: changes");
    expect(input).toContain("### idea.md\n\n~~~~md\nan idea\n~~~~");
    expect(input).toContain("### edited.md");
    expect(input).not.toContain("### kept.md");
    expect(input).not.toContain("### AGENTS.md");
    expect(input).toContain("not part of this run: kept.md");
    expect(input).toContain("user:\nhello");
    expect(input).toContain("- recent sighting");
    expect(input).not.toContain("too old");
    expect(input).not.toContain("not a dream");
  });

  test("says when an input is missing", async () => {
    const { root, sessionsDir } = await createFixture();
    const input = await buildDreamInput({ root, days: [DAY], notesDir: root, sessionsDir, changes: null, pullRequests: "gh is not authenticated" });

    expect(input).toContain("## Uncommitted changes\n\nNone.");
    expect(input).toContain("## Root notes\n\nNone.");
    expect(input).toContain("## Conversations\n\nNone.");
    expect(input).toContain("Unavailable: gh is not authenticated");
  });
});
