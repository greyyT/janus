import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomically } from "./filesystem.js";

export interface CalendarConfig {
  timezone?: string;
  planning_hours?: { start: string; end: string };
  calendars?: CalendarSourceConfig[];
}

export interface CalendarSourceConfig {
  name: string;
  url: string;
}

export interface CalendarEventOccurrence {
  uid: string;
  summary: string;
  start: string;
  end: string;
  all_day: boolean;
  calendar?: string;
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
  message?: string;
  warnings?: string[];
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

export interface AddCalendarSubscriptionOptions {
  url: string;
  name?: string;
  timezone?: string;
}

export interface AddCalendarSubscriptionResult {
  action: "added_calendar" | "calendar_already_configured";
  config_path: ".janus/calendar/config.json";
  calendar: CalendarSourceConfig;
  calendar_count: number;
}

export type CalendarIcsFetcher = (url: string) => Promise<string>;

const DEFAULT_TIMEZONE = "UTC";
const DEFAULT_PLANNING_HOURS = { start: "09:00", end: "22:00" };

export async function loadCalendarDay(repositoryRoot: string, date: string): Promise<CalendarDayAvailability> {
  const calendarRoot = path.join(repositoryRoot, ".janus", "calendar");
  const icsPath = path.join(calendarRoot, "primary.ics");
  const configPath = path.join(calendarRoot, "config.json");
  const hasConfig = await pathExists(configPath);
  if (!hasConfig) {
    return {
      status: "unavailable",
      date,
      timezone: DEFAULT_TIMEZONE,
      events: [],
      busy: [],
      message: "No calendar config found at .janus/calendar/config.json.",
    };
  }

  const config = JSON.parse(await readFile(configPath, "utf8")) as CalendarConfig;
  const timezone = config.timezone ?? DEFAULT_TIMEZONE;

  if (config.calendars !== undefined && config.calendars.length > 0) {
    const results = await Promise.allSettled(config.calendars.map(async (calendar) => {
      const url = normalizeCalendarUrl(calendar.url);
      const content = await fetchCalendarIcs(url);
      const events = parseIcsEvents(content, timezone);
      return { calendar: { name: calendar.name, url }, events };
    }));
    const warnings: string[] = [];
    const occurrences = results.flatMap((result, index) => {
      const calendar = config.calendars?.[index];
      if (result.status === "rejected") {
        warnings.push(`Calendar "${calendar?.name ?? "unknown"}" unavailable: ${errorMessage(result.reason)}`);
        return [];
      }
      return occurrencesForDate(result.value.events, date, timezone).map((event) => ({ ...event, calendar: result.value.calendar.name }));
    }).sort(compareOccurrences);

    if (results.every((result) => result.status === "rejected")) {
      return {
        status: "unavailable",
        date,
        timezone,
        events: [],
        busy: [],
        message: "No configured calendars could be loaded.",
        warnings,
      };
    }

    const busy = mergeIntervals(occurrences.map((event) => ({ start: event.start, end: event.end })));
    return { status: "available", date, timezone, events: localizeOccurrences(occurrences, timezone), busy: localizeIntervals(busy, timezone), warnings: warnings.length > 0 ? warnings : undefined };
  }

  const hasIcs = await pathExists(icsPath);
  if (!hasIcs) {
    return {
      status: "unavailable",
      date,
      timezone,
      events: [],
      busy: [],
      message: "No local calendar export found at .janus/calendar/primary.ics.",
    };
  }

  const events = parseIcsEvents(await readFile(icsPath, "utf8"), timezone);
  const occurrences = occurrencesForDate(events, date, timezone).map((event) => ({ ...event, calendar: "primary" }));
  const busy = mergeIntervals(occurrences.map((event) => ({ start: event.start, end: event.end })));

  return { status: "available", date, timezone, events: localizeOccurrences(occurrences, timezone), busy: localizeIntervals(busy, timezone) };
}

export function formatCalendarHuman(day: CalendarDayAvailability): string {
  if (day.status === "unavailable") return `Calendar unavailable: ${day.message}`;
  const lines = [`Calendar ${day.date} (${day.timezone})`, "Busy:"];
  if (day.busy.length === 0) lines.push("- none");
  for (const interval of day.busy) lines.push(`- ${formatTime(interval.start)}-${formatTime(interval.end)}`);
  if (day.warnings?.length) {
    lines.push("Warnings:");
    for (const warning of day.warnings) lines.push(`- ${warning}`);
  }
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


export function normalizeCalendarUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const normalized = trimmed.startsWith("webcal://") ? `https://${trimmed.slice("webcal://".length)}` : trimmed;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new Error("calendar URL must be an https:// or webcal:// iCalendar feed");
  }
}

export function validateCalendarIcsContent(content: string): void {
  if (!content.includes("BEGIN:VCALENDAR") || !content.includes("END:VCALENDAR")) {
    throw new Error("calendar URL did not return iCalendar data; use Google Calendar's Secret address in iCal format");
  }
}

export async function fetchCalendarIcs(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`failed to fetch calendar "${url}": HTTP ${response.status}`);
  const content = await response.text();
  validateCalendarIcsContent(content);
  return content;
}

export async function addCalendarSubscription(
  repositoryRoot: string,
  options: AddCalendarSubscriptionOptions,
  fetcher: CalendarIcsFetcher = fetchCalendarIcs,
): Promise<AddCalendarSubscriptionResult> {
  const normalizedUrl = normalizeCalendarUrl(options.url);
  const content = await fetcher(normalizedUrl);
  validateCalendarIcsContent(content);

  const configPath = path.join(repositoryRoot, ".janus", "calendar", "config.json");
  const hasConfig = await pathExists(configPath);
  const config = hasConfig
    ? JSON.parse(await readFile(configPath, "utf8")) as CalendarConfig
    : {
      timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      planning_hours: DEFAULT_PLANNING_HOURS,
      calendars: [],
    };
  const calendars = config.calendars ?? [];
  const duplicateUrl = calendars.find((calendar) => normalizeCalendarUrl(calendar.url) === normalizedUrl);
  if (duplicateUrl !== undefined) {
    return {
      action: "calendar_already_configured",
      config_path: ".janus/calendar/config.json",
      calendar: duplicateUrl,
      calendar_count: calendars.length,
    };
  }

  const name = options.name ?? nextCalendarName(calendars);
  if (calendars.some((calendar) => calendar.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new Error(`calendar name "${name}" is already configured`);
  }

  const calendar = { name, url: normalizedUrl };
  const nextConfig: CalendarConfig = {
    ...config,
    timezone: options.timezone ?? config.timezone ?? (new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
    planning_hours: config.planning_hours ?? DEFAULT_PLANNING_HOURS,
    calendars: [...calendars, calendar],
  };
  await writeJsonAtomically(configPath, nextConfig);

  return {
    action: "added_calendar",
    config_path: ".janus/calendar/config.json",
    calendar,
    calendar_count: nextConfig.calendars?.length ?? 0,
  };
}

function localizeOccurrences(events: CalendarEventOccurrence[], timezone: string): CalendarEventOccurrence[] {
  return events.map((event) => ({
    ...event,
    start: formatDateTimeInTimezone(event.start, timezone),
    end: formatDateTimeInTimezone(event.end, timezone),
  }));
}

function localizeIntervals(intervals: BusyInterval[], timezone: string): BusyInterval[] {
  return intervals.map((interval) => ({
    start: formatDateTimeInTimezone(interval.start, timezone),
    end: formatDateTimeInTimezone(interval.end, timezone),
  }));
}

function formatDateTimeInTimezone(value: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}T${values.get("hour")}:${values.get("minute")}:${values.get("second")}`;
}

function occurrencesForDate(events: RawEvent[], date: string, timezone: string): CalendarEventOccurrence[] {
  const dayStart = zonedTimeToUtc(date, "00:00", timezone);
  const dayEnd = zonedTimeToUtc(date, "23:59", timezone);
  return events.flatMap((event) => expandEventForDate(event, dayStart, dayEnd));
}

function compareOccurrences(a: CalendarEventOccurrence, b: CalendarEventOccurrence): number {
  return a.start.localeCompare(b.start)
    || a.end.localeCompare(b.end)
    || (a.calendar ?? "").localeCompare(b.calendar ?? "")
    || a.uid.localeCompare(b.uid);
}

function nextCalendarName(calendars: CalendarSourceConfig[]): string {
  const names = new Set(calendars.map((calendar) => calendar.name.toLocaleLowerCase()));
  let index = 1;
  while (names.has(`calendar ${index}`)) index += 1;
  return `Calendar ${index}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
