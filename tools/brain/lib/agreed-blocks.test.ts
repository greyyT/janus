import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { isoWeekKey, loadAgreedBlocks } from "./agreed-blocks.js";

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "janus-blocks-"));
  await mkdir(path.join(root, "tickets"), { recursive: true });
  await mkdir(path.join(root, "brain", "reading"), { recursive: true });
  await writeFile(path.join(root, "tickets", "J-036-compare.md"), [
    "## Goal commitment",
    "- Blocks:",
    "  - C1-B1: 2026-11-02 (Mon) 13:30, 30 min; stop: 30 minutes; calendar status: not placed; result: pending.",
    "  - C1-B2: 2026-11-03 (Tue) 14:00, 30 min; result: pending.",
  ].join("\n"), "utf8");
  await writeFile(path.join(root, "tickets", "J-108-prep.md"), [
    "## Task commitment",
    "  - C1-B1: 2026-11-02 (Mon) evening, 30 min; stop: 30 minutes; result: pending.",
    "  - C2-B1: 2026-11-02 16:00, 30 min; result: fulfilled.",
    "- 2026-11-02: C1-B1 agreed in a work-log line that is not a block.",
  ].join("\n"), "utf8");
  await writeFile(path.join(root, "brain", "reading", "DDIA.md"), [
    "## Reading commitment",
    "- Blocks (C6):",
    "  - C6-B1: one 2026-W45 weekday morning, 30 min, before work; result: pending.",
    "  - C5-B1: 2026-10-27 from about 15:00; result: excused.",
  ].join("\n"), "utf8");
  return root;
}

describe("loadAgreedBlocks", () => {
  test("finds pending blocks for the date and week-only blocks, regardless of heading", async () => {
    const root = await createFixture();
    const blocks = await loadAgreedBlocks(root, "2026-11-02");
    expect(blocks.map((block) => [block.owner, block.label, block.day_fixed])).toEqual([
      [path.join("tickets", "J-036-compare.md"), "C1-B1", true],
      [path.join("tickets", "J-108-prep.md"), "C1-B1", true],
      [path.join("brain", "reading", "DDIA.md"), "C6-B1", false],
    ]);
  });

  test("returns nothing for a date with no blocks outside the week", async () => {
    const root = await createFixture();
    expect(await loadAgreedBlocks(root, "2026-11-20")).toEqual([]);
  });
});

describe("isoWeekKey", () => {
  test("computes ISO weeks across year boundaries", () => {
    expect(isoWeekKey({ year: 2026, month: 11, day: 2 })).toBe("2026-W45");
    expect(isoWeekKey({ year: 2026, month: 11, day: 8 })).toBe("2026-W45");
    expect(isoWeekKey({ year: 2027, month: 1, day: 1 })).toBe("2026-W53");
  });
});
