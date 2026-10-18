import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { buildWeeklyInput, weekDays, type PullRequest } from "./input.js";

function pr(headRefName: string, createdAt: string, body: string): PullRequest {
  return { headRefName, url: `https://example/${headRefName}`, createdAt, state: "MERGED", body };
}

describe("weekDays", () => {
  test("returns Monday to Sunday", () => {
    expect(weekDays("2026-10-18")).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
  });
});

describe("buildWeeklyInput", () => {
  test("gathers journals, the week's dream PRs, the previous weekly review, and the calendar", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "janus-weekly-input-"));
    const root = path.join(base, "janus");
    const sessionsDir = path.join(base, "sessions");
    await mkdir(path.join(root, "journal"), { recursive: true });
    await mkdir(sessionsDir, { recursive: true });
    await writeFile(path.join(root, "journal", "2026-10-14.md"), "# Wednesday\n", "utf8");

    const input = await buildWeeklyInput({
      root,
      dir: root,
      week: "2026-W42",
      days: weekDays("2026-10-18"),
      sessionsDir,
      commits: "abc123 2026-10-14 dream: 2026-10-13",
      pullRequests: [
        pr("dream/2026-10-13", "2026-10-14T00:00:00", "dreamed tuesday"),
        pr("dream/2026-10-18", "2026-10-19T00:00:00", "dreamed sunday"),
        pr("dream/2026-10-04", "2026-10-05T00:00:00", "last week"),
        pr("weekly/2026-W41", "2026-10-12T00:00:00", "previous review"),
        pr("weekly/2026-W40", "2026-10-05T00:00:00", "older review"),
      ],
      calendar: [{ day: "2026-10-19", text: "" }],
    });

    expect(input).toContain("Week: 2026-W42 (2026-10-12 to 2026-10-18)");
    expect(input).toContain("# Wednesday");
    expect(input).toContain("### 2026-10-12\n\nNo journal.");
    expect(input).toContain("dreamed tuesday");
    expect(input).toContain("dreamed sunday");
    expect(input).not.toContain("last week");
    expect(input).toContain("previous review");
    expect(input).not.toContain("older review");
    expect(input).toContain("### 2026-10-19\n\nNothing scheduled.");
  });
});
