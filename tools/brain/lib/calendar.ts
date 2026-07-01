import { access, readFile } from "node:fs/promises";
import path from "node:path";

export interface CalendarConfig {
  timezone?: string;
  planning_hours?: { start: string; end: string };
}

export interface CalendarEventOccurrence {
  uid: string;
  summary: string;
  start: string;
  end: string;
  all_day: boolean;
}

export interface BusyInterval {
  start: string;
  end: string;
}

export interface CalendarDayAvailability {
  status: "available" | "unavailable";
  date: string;
  timezone: string;
  events: CalendarEventOccurrence[];
  busy: BusyInterval[];
  free: BusyInterval[];
  message?: string;
}

interface RawEvent {
  uid: string;
  summary: string;
  start: IcsDate;
  end: IcsDate;
  rrule?: string;
  exdates: Set<string>;
}

interface IcsDate {
  value: string;
  date: Date;
  allDay: boolean;
}

const DEFAULT_TIMEZONE = "UTC";
const DEFAULT_PLANNING_HOURS = { start: "09:00", end: "22:00" };

export async function loadCalendarDay(repositoryRoot: string, date: string): Promise<CalendarDayAvailability> {
  const calendarRoot = path.join(repositoryRoot, ".janus", "calendar");
  const icsPath = path.join(calendarRoot, "primary.ics");
  const configPath = path.join(calendarRoot, "config.json");
  const hasIcs = await pathExists(icsPath);
  const hasConfig = await pathExists(configPath);
  if (!hasIcs || !hasConfig) {
    return {
      status: "unavailable",
      date,
      timezone: DEFAULT_TIMEZONE,
      events: [],
      busy: [],
      free: [],
      message: "No local calendar export found at .janus/calendar/primary.ics and .janus/calendar/config.json.",
    };
  }

  const config = JSON.parse(await readFile(configPath, "utf8")) as CalendarConfig;
  const timezone = config.timezone ?? DEFAULT_TIMEZONE;
  const planningHours = config.planning_hours ?? DEFAULT_PLANNING_HOURS;
  const events = parseIcsEvents(await readFile(icsPath, "utf8"), timezone);
  const dayStart = zonedTimeToUtc(date, "00:00", timezone);
  const dayEnd = zonedTimeToUtc(date, "23:59", timezone);
  const occurrences = events.flatMap((event) => expandEventForDate(event, dayStart, dayEnd));
  const busy = mergeIntervals(occurrences.map((event) => ({ start: event.start, end: event.end })));
  const free = calculateFreeBlocks(date, planningHours.start, planningHours.end, busy, timezone);

  return { status: "available", date, timezone, events: occurrences, busy, free };
}

export function formatCalendarHuman(day: CalendarDayAvailability): string {
  if (day.status === "unavailable") return `Calendar unavailable: ${day.message}`;
  const lines = [`Calendar ${day.date} (${day.timezone})`, "Busy:"];
  if (day.busy.length === 0) lines.push("- none");
  for (const interval of day.busy) lines.push(`- ${formatTime(interval.start)}-${formatTime(interval.end)}`);
  lines.push("Free:");
  if (day.free.length === 0) lines.push("- none");
  for (const interval of day.free) lines.push(`- ${formatTime(interval.start)}-${formatTime(interval.end)}`);
  return lines.join("\n");
}

export function parseIcsEvents(content: string, defaultTimezone = DEFAULT_TIMEZONE): RawEvent[] {
  const unfolded = unfoldLines(content);
  const events: RawEvent[] = [];
  let current: Record<string, string[]> | null = null;

  for (const line of unfolded) {
    if (line === "BEGIN:VEVENT") current = {};
    else if (line === "END:VEVENT") {
      if (current !== null) events.push(toRawEvent(current, defaultTimezone));
      current = null;
    } else if (current !== null) {
      const separator = line.indexOf(":");
      if (separator === -1) continue;
      const key = line.slice(0, separator);
      const name = key.split(";")[0];
      current[name] = [...(current[name] ?? []), line];
    }
  }

  return events;
}

export function mergeIntervals(intervals: BusyInterval[]): BusyInterval[] {
  const sorted = intervals
    .filter((interval) => interval.start < interval.end)
    .sort((a, b) => a.start.localeCompare(b.start));
  const merged: BusyInterval[] = [];

  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last === undefined || interval.start > last.end) merged.push({ ...interval });
    else if (interval.end > last.end) last.end = interval.end;
  }

  return merged;
}

export function calculateFreeBlocks(date: string, startTime: string, endTime: string, busy: BusyInterval[], timezone = DEFAULT_TIMEZONE): BusyInterval[] {
  const start = zonedTimeToUtc(date, startTime, timezone).toISOString();
  const end = zonedTimeToUtc(date, endTime, timezone).toISOString();
  let cursor = start;
  const free: BusyInterval[] = [];

  for (const interval of busy) {
    const clippedStart = interval.start < start ? start : interval.start;
    const clippedEnd = interval.end > end ? end : interval.end;
    if (clippedEnd <= start || clippedStart >= end) continue;
    if (cursor < clippedStart) free.push({ start: cursor, end: clippedStart });
    if (cursor < clippedEnd) cursor = clippedEnd;
  }

  if (cursor < end) free.push({ start: cursor, end });
  return free;
}

function expandEventForDate(event: RawEvent, dayStart: Date, dayEnd: Date): CalendarEventOccurrence[] {
  const dates = event.rrule === undefined ? [event.start.date] : expandRecurrence(event, dayEnd);
  const durationMs = event.end.date.getTime() - event.start.date.getTime();

  return dates.flatMap((startDate) => {
    const startKey = formatDateKey(startDate, event.start.allDay);
    if (event.exdates.has(startKey)) return [];
    const endDate = new Date(startDate.getTime() + durationMs);
    if (endDate <= dayStart || startDate > dayEnd) return [];
    return [{
      uid: event.uid,
      summary: event.summary,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      all_day: event.start.allDay,
    }];
  });
}

function expandRecurrence(event: RawEvent, until: Date): Date[] {
  const rule = parseRule(event.rrule ?? "");
  const frequency = rule.get("FREQ");
  if (frequency !== "DAILY" && frequency !== "WEEKLY") return [event.start.date];

  const count = rule.has("COUNT") ? Number(rule.get("COUNT")) : Number.POSITIVE_INFINITY;
  const untilDate = rule.has("UNTIL") ? parseIcsDate(`UNTIL:${rule.get("UNTIL")}`, DEFAULT_TIMEZONE).date : until;
  const stepDays = frequency === "DAILY" ? 1 : 7;
  const starts: Date[] = [];
  let cursor = event.start.date;

  while (starts.length < count && cursor <= until && cursor <= untilDate) {
    starts.push(cursor);
    cursor = new Date(cursor.getTime() + stepDays * 24 * 60 * 60 * 1000);
  }

  return starts;
}

function toRawEvent(fields: Record<string, string[]>, defaultTimezone: string): RawEvent {
  const dtstart = fields.DTSTART?.[0];
  const dtend = fields.DTEND?.[0];
  if (dtstart === undefined || dtend === undefined) throw new Error("calendar event requires DTSTART and DTEND");
  const exdates = new Set((fields.EXDATE ?? []).flatMap((line) => parseExdates(line, defaultTimezone)));
  return {
    uid: valueOf(fields.UID?.[0]) ?? "",
    summary: valueOf(fields.SUMMARY?.[0]) ?? "(untitled)",
    start: parseIcsDate(dtstart, defaultTimezone),
    end: parseIcsDate(dtend, defaultTimezone),
    rrule: valueOf(fields.RRULE?.[0]),
    exdates,
  };
}

function parseIcsDate(line: string, defaultTimezone: string): IcsDate {
  const value = line.slice(line.indexOf(":") + 1);
  const allDay = line.includes("VALUE=DATE") || /^\d{8}$/u.test(value);
  if (allDay) {
    return { value, allDay, date: new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00.000Z`) };
  }

  const timezone = value.endsWith("Z") ? "UTC" : getLineTimezone(line) ?? defaultTimezone;
  const compact = value.endsWith("Z") ? value.slice(0, -1) : value;
  const date = compact.slice(0, 8);
  const time = compact.slice(9, 13);
  return {
    value,
    allDay,
    date: zonedTimeToUtc(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`, `${time.slice(0, 2)}:${time.slice(2, 4)}`, timezone),
  };
}

function formatDateKey(date: Date, allDay: boolean): string {
  if (allDay) return date.toISOString().slice(0, 10).replaceAll("-", "");
  return date.toISOString().replaceAll("-", "").replaceAll(":", "").slice(0, 15) + "Z";
}

function parseExdates(line: string, defaultTimezone: string): string[] {
  const prefix = line.slice(0, line.indexOf(":"));
  const values = line.slice(line.indexOf(":") + 1).split(",").filter(Boolean);
  return values.map((value) => {
    const parsed = parseIcsDate(`${prefix}:${value}`, defaultTimezone);
    return formatDateKey(parsed.date, parsed.allDay);
  });
}

function getLineTimezone(line: string): string | null {
  const key = line.slice(0, line.indexOf(":"));
  const timezonePart = key.split(";").find((part) => part.startsWith("TZID="));
  return timezonePart?.slice("TZID=".length) ?? null;
}

function zonedTimeToUtc(date: string, time: string, timezone: string): Date {
  const utc = new Date(`${date}T${time}:00.000Z`);
  const firstOffset = getTimeZoneOffsetMs(timezone, utc);
  const first = new Date(utc.getTime() - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(timezone, first);
  return new Date(utc.getTime() - secondOffset);
}

function getTimeZoneOffsetMs(timezone: string, date: Date): number {
  if (timezone === "UTC") return 0;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.get("year")),
    Number(values.get("month")) - 1,
    Number(values.get("day")),
    Number(values.get("hour")),
    Number(values.get("minute")),
    Number(values.get("second")),
  );
  return asUtc - date.getTime();
}

function parseRule(rule: string): Map<string, string> {
  return new Map(rule.split(";").map((part) => {
    const [key, value] = part.split("=");
    return [key, value] as const;
  }));
}

function valueOf(line: string | undefined): string | undefined {
  if (line === undefined) return undefined;
  return line.slice(line.indexOf(":") + 1);
}

function unfoldLines(content: string): string[] {
  const lines: string[] = [];
  for (const rawLine of content.replace(/\r\n/gu, "\n").split("\n")) {
    if ((rawLine.startsWith(" ") || rawLine.startsWith("\t")) && lines.length > 0) lines[lines.length - 1] += rawLine.slice(1);
    else if (rawLine.length > 0) lines.push(rawLine);
  }
  return lines;
}

function formatTime(value: string): string {
  return value.slice(11, 16);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}
