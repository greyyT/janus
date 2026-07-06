import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { loadCalendarDay, mergeIntervals, type CalendarConfig } from "./calendar.js";

const WORK_ICS = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:work\nSUMMARY:Work meeting\nDTSTART:20260630T100000Z\nDTEND:20260630T110000Z\nEND:VEVENT\nEND:VCALENDAR\n`;
const PERSONAL_ICS = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:personal\nSUMMARY:Personal appointment\nDTSTART:20260630T103000Z\nDTEND:20260630T113000Z\nEND:VEVENT\nEND:VCALENDAR\n`;

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

async function writeCalendarConfig(root: string, config: CalendarConfig): Promise<void> {
  await mkdir(path.join(root, ".janus", "calendar"), { recursive: true });
  await writeFile(path.join(root, ".janus", "calendar", "config.json"), JSON.stringify(config), "utf8");
}

function stubFetch(feeds: Record<string, string | Error>): void {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const value = feeds[url];
    if (value instanceof Error) throw value;
    if (value === undefined) return new Response("missing", { status: 404 });
    return new Response(value, { status: 200 });
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadCalendarDay", () => {
  test("returns unavailable when calendar config is missing", async () => {
    const root = await createFixture();
    await expect(loadCalendarDay(root, "2026-06-30")).resolves.toMatchObject({
      status: "unavailable",
      events: [],
      message: "No calendar config found at .janus/calendar/config.json.",
    });
  });

  test("loads timed and all-day events from legacy primary calendar", async () => {
    const root = await createFixture();
    await writeCalendar(root, `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:timed\nSUMMARY:Meeting\nDTSTART:20260630T100000Z\nDTEND:20260630T110000Z\nEND:VEVENT\nBEGIN:VEVENT\nUID:all-day\nSUMMARY:Holiday\nDTSTART;VALUE=DATE:20260630\nDTEND;VALUE=DATE:20260701\nEND:VEVENT\nEND:VCALENDAR\n`);

    const day = await loadCalendarDay(root, "2026-06-30");

    expect(day.status).toBe("available");
    expect(day.events.map((event) => event.uid)).toEqual(["timed", "all-day"]);
    expect(day.events.every((event) => event.calendar === "primary")).toBe(true);
  });

  test("loads multiple configured calendars and merges overlapping busy intervals", async () => {
    const root = await createFixture();
    await writeCalendarConfig(root, {
      timezone: "UTC",
      planning_hours: { start: "09:00", end: "12:00" },
      calendars: [
        { name: "Work", url: "https://calendar.example/work.ics" },
        { name: "Personal", url: "https://calendar.example/personal.ics" },
      ],
    });
    stubFetch({
      "https://calendar.example/work.ics": WORK_ICS,
      "https://calendar.example/personal.ics": PERSONAL_ICS,
    });

    const day = await loadCalendarDay(root, "2026-06-30");

    expect(day.status).toBe("available");
    expect(day.events.map((event) => ({ uid: event.uid, calendar: event.calendar }))).toEqual([
      { uid: "work", calendar: "Work" },
      { uid: "personal", calendar: "Personal" },
    ]);
    expect(day.busy).toEqual([{ start: "2026-06-30T10:00:00", end: "2026-06-30T11:30:00" }]);
  });

  test("returns available with warnings when one configured feed fails", async () => {
    const root = await createFixture();
    await writeCalendarConfig(root, {
      timezone: "UTC",
      calendars: [
        { name: "Work", url: "https://calendar.example/work.ics" },
        { name: "Personal", url: "https://calendar.example/personal.ics" },
      ],
    });
    stubFetch({
      "https://calendar.example/work.ics": WORK_ICS,
      "https://calendar.example/personal.ics": new Error("HTTP 403"),
    });

    const day = await loadCalendarDay(root, "2026-06-30");

    expect(day.status).toBe("available");
    expect(day.events).toHaveLength(1);
    expect(day.warnings).toEqual(["Calendar \"Personal\" unavailable: HTTP 403"]);
  });

  test("returns unavailable when all configured feeds fail", async () => {
    const root = await createFixture();
    await writeCalendarConfig(root, {
      timezone: "UTC",
      calendars: [
        { name: "Work", url: "https://calendar.example/work.ics" },
        { name: "Personal", url: "https://calendar.example/personal.ics" },
      ],
    });
    stubFetch({
      "https://calendar.example/work.ics": new Error("HTTP 403"),
      "https://calendar.example/personal.ics": new Error("HTTP 404"),
    });

    const day = await loadCalendarDay(root, "2026-06-30");

    expect(day).toMatchObject({
      status: "unavailable",
      message: "No configured calendars could be loaded.",
      events: [],
      busy: [],
      warnings: ["Calendar \"Work\" unavailable: HTTP 403", "Calendar \"Personal\" unavailable: HTTP 404"],
    });
  });

  test("expands recurring events and honors recurrence exceptions", async () => {
    const root = await createFixture();
    await writeCalendar(root, `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:daily\nSUMMARY:Standup\nDTSTART:20260629T100000Z\nDTEND:20260629T103000Z\nRRULE:FREQ=DAILY;COUNT=3\nEXDATE:20260630T100000Z\nEND:VEVENT\nEND:VCALENDAR\n`);

    const skipped = await loadCalendarDay(root, "2026-06-30");
    const included = await loadCalendarDay(root, "2026-07-01");

    expect(skipped.events).toEqual([]);
    expect(included.events).toHaveLength(1);
  });

  test("uses configured time zone for floating event times", async () => {
    const root = await createFixture();
    await writeCalendar(root, `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:tz\nSUMMARY:Local meeting\nDTSTART;TZID=America/New_York:20260630T090000\nDTEND;TZID=America/New_York:20260630T100000\nEND:VEVENT\nEND:VCALENDAR\n`, "America/New_York");

    const day = await loadCalendarDay(root, "2026-06-30");

    expect(day.events[0]).toMatchObject({
      uid: "tz",
      start: "2026-06-30T09:00:00",
      end: "2026-06-30T10:00:00",
    });
  });
});

describe("busy blocks", () => {
  test("merges overlapping busy intervals", () => {
    expect(mergeIntervals([
      { start: "2026-06-30T10:00:00.000Z", end: "2026-06-30T11:00:00.000Z" },
      { start: "2026-06-30T10:30:00.000Z", end: "2026-06-30T12:00:00.000Z" },
    ])).toEqual([{ start: "2026-06-30T10:00:00.000Z", end: "2026-06-30T12:00:00.000Z" }]);
  });
});
