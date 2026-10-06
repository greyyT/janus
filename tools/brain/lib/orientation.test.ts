import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { CalendarEventOccurrence } from "./calendar.js";
import { orient, parseBoard, type OrientationSources } from "./orientation.js";

const BOARD = `# Board

## Active

- [[tickets/J-062-memory-spike|Integrate a memory provider]] · J-062 · autonomous
- [[tickets/J-063-hindsight|Implement Hindsight memory]] · J-063 · human_required
  - needs user: approve the eval results

## Ready

- [[tickets/J-070-later|Something later]] · J-070
`;

function event(summary: string, start: string, end: string): CalendarEventOccurrence {
  return { uid: summary, summary, start: `2026-01-15T${start}:00`, end: `2026-01-15T${end}:00`, all_day: false };
}

async function createRoot(board = BOARD): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "janus-orientation-"));
  await mkdir(path.join(root, "tickets"));
  await mkdir(path.join(root, ".janus", "dream"), { recursive: true });
  await writeFile(path.join(root, "tickets", "BOARD.md"), board, "utf8");
  return root;
}

function sources(hour: number, overrides: Partial<OrientationSources> = {}): OrientationSources {
  return {
    now: new Date(2026, 0, 15, hour),
    loadCalendar: async (date) => ({
      status: "available",
      date,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      events: [event("Standup", "09:00", "09:15"), event("Sprint review", "14:00", "15:00")],
      busy: [],
    }),
    isPullRequestOpen: async () => true,
    ...overrides,
  };
}

describe("parseBoard", () => {
  test("reads execution markers and the needs-user line, ignoring other entries", () => {
    expect(parseBoard(BOARD)).toEqual([
      { id: "J-062", title: "Integrate a memory provider", execution: "autonomous", needsUser: null },
      { id: "J-063", title: "Implement Hindsight memory", execution: "human_required", needsUser: "approve the eval results" },
    ]);
  });
});

describe("orient", () => {
  test("lists everything once a day, then only what is new", async () => {
    const root = await createRoot();
    const first = await orient(root, sources(10));
    expect(first).toContain("Today's orientation:");
    expect(first).toContain("- Implement Hindsight memory (J-063): approve the eval results");
    expect(first).toContain("- 14:00–15:00 Sprint review (calendar)");
    expect(first).not.toContain("Standup");
    expect(first).toContain("Moving on its own:\n- Integrate a memory provider (J-062)");

    expect(await orient(root, sources(11))).toBeNull();

    await writeFile(path.join(root, ".janus", "dream", "pr"), "https://github.com/x/pull/1\n", "utf8");
    const later = await orient(root, sources(12));
    expect(later).toContain("New since the last orientation:");
    expect(later).toContain("Dream PR waiting for the user's merge: https://github.com/x/pull/1");
    expect(later).not.toContain("J-063");
    expect(later).not.toContain("Moving on its own");
  });

  test("shows a ticket again when what the user must do changes, and everything again the next day", async () => {
    const root = await createRoot();
    await orient(root, sources(10));
    await writeFile(path.join(root, "tickets", "BOARD.md"), BOARD.replace("approve the eval results", "approve done"), "utf8");
    expect(await orient(root, sources(11))).toContain("Implement Hindsight memory (J-063): approve done");

    const nextDay = await orient(root, { ...sources(8), now: new Date(2026, 0, 16, 8) });
    expect(nextDay).toContain("Today's orientation:");
  });

  test("says nothing when nothing needs the user, and checks a closed dream PR only once", async () => {
    const root = await createRoot(BOARD.replace(/- \[\[tickets\/J-063[\s\S]*?results\n/, ""));
    await writeFile(path.join(root, ".janus", "dream", "pr"), "https://github.com/x/pull/1\n", "utf8");
    let checks = 0;
    const quiet = sources(16, {
      loadCalendar: async (date) => ({ status: "unavailable", date, timezone: "UTC", events: [], busy: [] }),
      isPullRequestOpen: async () => {
        checks += 1;
        return false;
      },
    });
    expect(await orient(root, quiet)).toBeNull();
    expect(await orient(root, quiet)).toBeNull();
    expect(checks).toBe(1);
  });

  test("asks GitHub again on the next turn when it could not be reached", async () => {
    const root = await createRoot("");
    await writeFile(path.join(root, ".janus", "dream", "pr"), "https://github.com/x/pull/2\n", "utf8");
    const answers = [null, true];
    const offline = sources(16, { isPullRequestOpen: async () => answers.shift() ?? null });
    expect(await orient(root, offline)).toBeNull();
    expect(await orient(root, offline)).toContain("Dream PR waiting for the user's merge: https://github.com/x/pull/2");
  });
});
