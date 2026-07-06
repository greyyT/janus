import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { addCalendarSubscription } from "./lib/calendar.js";

const execFileAsync = promisify(execFile);
const NODE = process.execPath;
const TSX_IMPORT = path.resolve("node_modules/tsx/dist/loader.mjs");
const CALENDAR_ADD = path.resolve("tools/brain/calendar-add.ts");
const ICS = "BEGIN:VCALENDAR\nEND:VCALENDAR\n";

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "janus-calendar-add-"));
  await writeRepositoryMarkers(root);
  return root;
}

async function writeRepositoryMarkers(root: string): Promise<void> {
  await writeFile(path.join(root, "package.json"), "{}", "utf8");
  await writeFile(path.join(root, "AGENTS.md"), "# Agents", "utf8");
}

async function readConfig(root: string): Promise<{ timezone: string; calendars: Array<{ name: string; url: string }> }> {
  return JSON.parse(await readFile(path.join(root, ".janus", "calendar", "config.json"), "utf8"));
}

describe("addCalendarSubscription", () => {
  test("adds first calendar with the default name", async () => {
    const root = await createFixture();

    const result = await addCalendarSubscription(root, { url: "https://calendar.example/work.ics", timezone: "Asia/Ho_Chi_Minh" }, async () => ICS);

    expect(result).toEqual({
      action: "added_calendar",
      config_path: ".janus/calendar/config.json",
      calendar: { name: "Calendar 1", url: "https://calendar.example/work.ics" },
      calendar_count: 1,
    });
    await expect(readConfig(root)).resolves.toMatchObject({
      timezone: "Asia/Ho_Chi_Minh",
      planning_hours: { start: "09:00", end: "22:00" },
      calendars: [{ name: "Calendar 1", url: "https://calendar.example/work.ics" }],
    });
  });

  test("adds named second calendar", async () => {
    const root = await createFixture();
    await addCalendarSubscription(root, { url: "https://calendar.example/work.ics", name: "Work" }, async () => ICS);

    const result = await addCalendarSubscription(root, { url: "https://calendar.example/personal.ics", name: "Personal" }, async () => ICS);

    expect(result.calendar).toEqual({ name: "Personal", url: "https://calendar.example/personal.ics" });
    expect(result.calendar_count).toBe(2);
  });

  test("normalizes webcal URLs to https before storing", async () => {
    const root = await createFixture();

    const result = await addCalendarSubscription(root, { url: "webcal://calendar.example/work.ics", name: "Work" }, async () => ICS);

    expect(result.calendar.url).toBe("https://calendar.example/work.ics");
    await expect(readConfig(root)).resolves.toMatchObject({ calendars: [{ name: "Work", url: "https://calendar.example/work.ics" }] });
  });

  test("rejects duplicate names case-insensitively", async () => {
    const root = await createFixture();
    await addCalendarSubscription(root, { url: "https://calendar.example/work.ics", name: "Work" }, async () => ICS);

    await expect(addCalendarSubscription(root, { url: "https://calendar.example/other.ics", name: "work" }, async () => ICS))
      .rejects.toThrow('calendar name "work" is already configured');
  });

  test("treats duplicate URL as already configured", async () => {
    const root = await createFixture();
    await addCalendarSubscription(root, { url: "webcal://calendar.example/work.ics", name: "Work" }, async () => ICS);

    const result = await addCalendarSubscription(root, { url: "https://calendar.example/work.ics", name: "Duplicate" }, async () => ICS);

    expect(result).toEqual({
      action: "calendar_already_configured",
      config_path: ".janus/calendar/config.json",
      calendar: { name: "Work", url: "https://calendar.example/work.ics" },
      calendar_count: 1,
    });
  });

  test("rejects non-iCalendar responses without writing config", async () => {
    const root = await createFixture();

    await expect(addCalendarSubscription(root, { url: "https://calendar.example/page", name: "Work" }, async () => "<html></html>"))
      .rejects.toThrow("calendar URL did not return iCalendar data; use Google Calendar's Secret address in iCal format");
    await expect(readFile(path.join(root, ".janus", "calendar", "config.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("calendar-add CLI", () => {
  test("rejects invalid URL scheme before writing config", async () => {
    const root = await createFixture();

    await expect(execFileAsync(NODE, ["--import", TSX_IMPORT, CALENDAR_ADD, "--url", "ftp://calendar.example/work.ics", "--json"], { cwd: root }))
      .rejects.toMatchObject({ stderr: "calendar URL must be an https:// or webcal:// iCalendar feed\n" });
  });
});
