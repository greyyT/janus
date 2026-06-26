import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { parseCivilDate } from "./civil-date.js";
import { buildCheckinReport, parseCheckin } from "./tracking.js";

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "janus-checkin-"));
  await writeFile(path.join(root, "package.json"), "{}", "utf8");
  await writeFile(path.join(root, "AGENTS.md"), "# Agents", "utf8");
  await mkdir(path.join(root, "journal"), { recursive: true });
  return root;
}

describe("parseCheckin", () => {
  test.each([
    ["- wellbeing: 3", 3],
    ["-   wellbeing: 3", 3],
    ["- wellbeing : 3", 3],
    ["- wellbeing:    3", 3],
  ])("accepts %s", (line, score) => {
    expect(parseCheckin(`## Check-in\n\n${line}`, "journal/2026-06-25.md")).toMatchObject({ score });
  });

  test.each([
    "* wellbeing: 3",
    "- Wellbeing: 3",
    "text wellbeing: 3",
  ])("ignores unrecognized line %s", (line) => {
    expect(parseCheckin(`## Check-in\n${line}`, "journal/2026-06-25.md")).toEqual({ score: null, warnings: [] });
  });

  test.each([
    ["- wellbeing:", null, []],
    ["- wellbeing: 0", null, ["invalid_wellbeing_value"]],
    ["- wellbeing: 6", null, ["invalid_wellbeing_value"]],
    ["- wellbeing: okay", null, ["invalid_wellbeing_value"]],
    ["- wellbeing: +3", null, ["invalid_wellbeing_value"]],
    ["- wellbeing: -3", null, ["invalid_wellbeing_value"]],
    ["- wellbeing: 3.0", null, ["invalid_wellbeing_value"]],
    ["- wellbeing: 3 # comment", null, ["invalid_wellbeing_value"]],
  ] as const)("handles value %s", (line, score, warningCodes) => {
    const result = parseCheckin(`## Check-in\n${line}`, "journal/2026-06-25.md");

    expect(result.score).toBe(score);
    expect(result.warnings.map((warning) => warning.code)).toEqual(warningCodes);
  });

  test("uses the last valid duplicate value and warns once", () => {
    const result = parseCheckin("## Check-in\n- wellbeing: 2\n- wellbeing: 4", "journal/2026-06-25.md");

    expect(result.score).toBe(4);
    expect(result.warnings.map((warning) => warning.code)).toEqual(["duplicate_wellbeing_value"]);
  });

  test("keeps valid score when an invalid later entry appears", () => {
    const result = parseCheckin("## Check-in\n- wellbeing: 3\n- wellbeing: 6", "journal/2026-06-25.md");

    expect(result.score).toBe(3);
    expect(result.warnings.map((warning) => warning.code)).toEqual(["invalid_wellbeing_value"]);
  });

  test("uses a valid score after an invalid entry", () => {
    const result = parseCheckin("## Check-in\n- wellbeing: nope\n- wellbeing: 5", "journal/2026-06-25.md");

    expect(result.score).toBe(5);
    expect(result.warnings.map((warning) => warning.code)).toEqual(["invalid_wellbeing_value"]);
  });

  test("parses only the exact Check-in H2 and stops at the next H2", () => {
    const content = "## check-in\n- wellbeing: 1\n\n## Check-in\n- wellbeing: 3\n\n## Later\n- wellbeing: 1";

    expect(parseCheckin(content, "journal/2026-06-25.md")).toEqual({ score: 3, warnings: [] });
  });
});

describe("buildCheckinReport", () => {
  test("builds an anchored 7-day window with missing journals and empty scores", async () => {
    const root = await createFixture();
    await writeFile(path.join(root, "journal", "2026-06-19.md"), "## Check-in\n- wellbeing: 3", "utf8");
    await writeFile(path.join(root, "journal", "2026-06-20.md"), "## Check-in\n- wellbeing:", "utf8");
    await writeFile(path.join(root, "journal", "2026-06-21.md"), "## Check-in\n- wellbeing: 4", "utf8");
    await writeFile(path.join(root, "journal", "random-note.md"), "## Check-in\n- wellbeing: nope", "utf8");

    const to = parseCivilDate("2026-06-25");
    if (to === null) throw new Error("test date should parse");

    const report = await buildCheckinReport(root, to, 7);

    expect(report).toMatchObject({
      from: "2026-06-19",
      to: "2026-06-25",
      calendar_days: 7,
      days_with_journal: 3,
      recorded_days: 2,
      entries: [
        { date: "2026-06-19", path: "journal/2026-06-19.md", score: 3 },
        { date: "2026-06-21", path: "journal/2026-06-21.md", score: 4 },
      ],
      summary: { count: 2, mean: 3.5, min: 3, max: 4 },
      warnings: [],
    });
  });

  test("returns null summary when no valid scores exist", async () => {
    const root = await createFixture();
    await writeFile(path.join(root, "journal", "2026-06-25.md"), "## Check-in\n- wellbeing:", "utf8");

    const to = parseCivilDate("2026-06-25");
    if (to === null) throw new Error("test date should parse");

    const report = await buildCheckinReport(root, to, 7);

    expect(report.summary).toBeNull();
    expect(report.days_with_journal).toBe(1);
    expect(report.recorded_days).toBe(0);
  });
});
