import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatDateTimeInTimezone, type CalendarDayAvailability, type CalendarEventOccurrence } from "./calendar.js";
import { formatCivilDate, todayLocalCivilDate } from "./civil-date.js";
import { isNotFoundError, writeJsonAtomically } from "./filesystem.js";

export interface BoardTicket {
  id: string;
  title: string;
  execution: "autonomous" | "human_required";
  needsUser: string | null;
}

export interface OrientationSources {
  now: Date;
  loadCalendar: (date: string) => Promise<CalendarDayAvailability>;
  // null when GitHub cannot be reached: ask again on the next turn.
  isPullRequestOpen: (url: string) => Promise<boolean | null>;
}

interface OrientationState {
  date: string;
  timezone: string;
  events: CalendarEventOccurrence[];
  shown: string[];
}

interface Item {
  key: string;
  line: string;
}

const ENTRY = /^- \[\[[^\]|]+\|([^\]]+)\]\] · (J-\d+) · (autonomous|human_required)\s*$/;
const NEEDS_USER = /^\s+- needs user: (.+)$/;

export function parseBoard(markdown: string): BoardTicket[] {
  const tickets: BoardTicket[] = [];
  for (const line of markdown.split("\n")) {
    const entry = ENTRY.exec(line);
    if (entry !== null) {
      tickets.push({ title: entry[1], id: entry[2], execution: entry[3] as BoardTicket["execution"], needsUser: null });
      continue;
    }
    const needsUser = NEEDS_USER.exec(line);
    const last = tickets.at(-1);
    if (needsUser !== null && last?.execution === "human_required") last.needsUser = needsUser[1].trim();
  }
  return tickets;
}

// Returns the orientation for the user's next turn, or null when nothing new
// needs them. The first orientation of the day lists everything; later ones
// only what appeared since, so parallel sessions learn of each other's changes.
export async function orient(root: string, sources: OrientationSources): Promise<string | null> {
  const statePath = path.join(root, ".janus", "orientation.json");
  const date = formatCivilDate(todayLocalCivilDate(sources.now));
  let state = await readState(statePath);
  if (state?.date !== date) {
    const calendar = await sources.loadCalendar(date);
    state = { date, timezone: calendar.timezone, events: calendar.events, shown: [] };
  }
  const isFirst = state.shown.length === 0;

  const tickets = parseBoard(await readOptional(path.join(root, "tickets", "BOARD.md")));
  const needsYou: Item[] = tickets
    .filter((ticket) => ticket.execution === "human_required")
    .map((ticket) => ({
      key: `ticket:${ticket.id}:${ticket.needsUser ?? ""}`,
      line: `${ticket.title} (${ticket.id}): ${ticket.needsUser ?? "needs the user"}`,
    }));

  const pullRequest = (await readOptional(path.join(root, ".janus", "dream", "pr"))).trim();
  const pullRequestKey = `dream:${pullRequest}`;
  if (pullRequest !== "" && !state.shown.includes(pullRequestKey)) {
    const isOpen = await sources.isPullRequestOpen(pullRequest);
    if (isOpen === true) needsYou.push({ key: pullRequestKey, line: `Dream PR waiting for the user's merge: ${pullRequest}` });
    else if (isOpen === false) state.shown.push(pullRequestKey);
  }

  const now = formatDateTimeInTimezone(sources.now.toISOString(), state.timezone);
  for (const event of state.events) {
    if (!event.all_day && event.end <= now) continue;
    const time = event.all_day ? "all day" : `${event.start.slice(11, 16)}–${event.end.slice(11, 16)}`;
    needsYou.push({ key: `event:${event.uid}:${event.start}`, line: `${time} ${event.summary} (calendar)` });
  }

  const fresh = needsYou.filter((item) => !state.shown.includes(item.key));
  if (fresh.length === 0) {
    await writeJsonAtomically(statePath, state);
    return null;
  }
  state.shown.push(...fresh.map((item) => item.key));
  await writeJsonAtomically(statePath, state);

  const lines = [
    isFirst ? "Today's orientation:" : "New since the last orientation:",
    "",
    "Needs the user:",
    ...fresh.map((item) => `- ${item.line}`),
  ];
  const autonomous = tickets.filter((ticket) => ticket.execution === "autonomous");
  if (isFirst && autonomous.length > 0) {
    lines.push("", "Moving on its own:", ...autonomous.map((ticket) => `- ${ticket.title} (${ticket.id})`));
  }
  lines.push(
    "",
    "Answer the user's message first. Then tell them the above briefly: one short line per item, by title and ID, and one line naming the work moving on its own. Leave out whatever this conversation already covered, and say nothing at all when that leaves nothing.",
  );
  return lines.join("\n");
}

async function readState(statePath: string): Promise<OrientationState | null> {
  try {
    return JSON.parse(await readFile(statePath, "utf8")) as OrientationState;
  } catch {
    return null;
  }
}

async function readOptional(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNotFoundError(error)) return "";
    throw error;
  }
}
