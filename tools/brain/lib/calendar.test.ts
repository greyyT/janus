import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { calculateFreeBlocks, loadCalendarDay, mergeIntervals } from "./calendar.js";

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "janus-calendar-"));
  await writeFile(path.join(root, "package.json"), "{}", "utf8");
  await writeFile(path.join(root, "AGENTS.md"), "# Agents", "utf8");
  return root;
}

async function writeCalendar(root: string, ics: string, timezone = "UTC"): Promise<void> {
  await mkdir(path.join(root, ".janus", "calendar"), { recursive: true });
  await writeFile(path.join(root, ".janus", "calendar", "config.json"), JSON.stringify({ timezone, planning_hours: { start: "09:00", end: "17:00" } }), "utf8");
  await writeFile(path.join(root, ".janus", "calendar", "primary.ics"), ics, "utf8");
}

describe("loadCalendarDay", () => {
  test("returns unavailable when local calendar files are missing", async () => {
    const root = await createFixture();
    await expect(loadCalendarDay(root, "2026-06-30")).resolves.toMatchObject({ status: "unavailable", events: [] });
  });

  test("loads timed and all-day events and calculates free blocks", async () => {
    const root = await createFixture();
    await writeCalendar(root, `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:timed\nSUMMARY:Meeting\nDTSTART:20260630T100000Z\nDTEND:20260630T110000Z\nEND:VEVENT\nBEGIN:VEVENT\nUID:all-day\nSUMMARY:Holiday\nDTSTART;VALUE=DATE:20260630\nDTEND;VALUE=DATE:20260701\nEND:VEVENT\nEND:VCALENDAR\n`);

    const day = await loadCalendarDay(root, "2026-06-30");

    expect(day.status).toBe("available");
    expect(day.events.map((event) => event.uid)).toEqual(["timed", "all-day"]);
    expect(day.free).toEqual([]);
  });

  test("expands recurring events and honors recurrence exceptions", async () => {
    const root = await createFixture();
    await writeCalendar(root, `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:daily\nSUMMARY:Standup\nDTSTART:20260629T100000Z\nDTEND:20260629T103000Z\nRRULE:FREQ=DAILY;COUNT=3\nEXDATE:20260630T100000Z\nEND:VEVENT\nEND:VCALENDAR\n`);

    const skipped = await loadCalendarDay(root, "2026-06-30");
    const included = await loadCalendarDay(root, "2026-07-01");

    expect(skipped.events).toEqual([]);
    expect(included.events).toHaveLength(1);
  });

  test("uses configured time zone for floating event times and planning hours", async () => {
    const root = await createFixture();
    await writeCalendar(root, `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:tz\nSUMMARY:Local meeting\nDTSTART;TZID=America/New_York:20260630T090000\nDTEND;TZID=America/New_York:20260630T100000\nEND:VEVENT\nEND:VCALENDAR\n`, "America/New_York");

    const day = await loadCalendarDay(root, "2026-06-30");

    expect(day.events[0]).toMatchObject({
      uid: "tz",
      start: "2026-06-30T13:00:00.000Z",
      end: "2026-06-30T14:00:00.000Z",
    });
    expect(day.free[0]).toEqual({ start: "2026-06-30T14:00:00.000Z", end: "2026-06-30T21:00:00.000Z" });
  });
});

describe("busy and free blocks", () => {
  test("merges overlapping busy intervals", () => {
    expect(mergeIntervals([
      { start: "2026-06-30T10:00:00.000Z", end: "2026-06-30T11:00:00.000Z" },
      { start: "2026-06-30T10:30:00.000Z", end: "2026-06-30T12:00:00.000Z" },
    ])).toEqual([{ start: "2026-06-30T10:00:00.000Z", end: "2026-06-30T12:00:00.000Z" }]);
  });

  test("calculates free blocks inside planning hours", () => {
    expect(calculateFreeBlocks("2026-06-30", "09:00", "12:00", [
      { start: "2026-06-30T10:00:00.000Z", end: "2026-06-30T11:00:00.000Z" },
    ])).toEqual([
      { start: "2026-06-30T09:00:00.000Z", end: "2026-06-30T10:00:00.000Z" },
      { start: "2026-06-30T11:00:00.000Z", end: "2026-06-30T12:00:00.000Z" },
    ]);
  });
});
