import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  addCivilDays,
  formatCivilDate,
  isNotFoundError,
  listJanusSessions,
  parseCivilDate,
  todayLocalCivilDate,
} from "../../brain/lib/index.js";

export interface PullRequest {
  headRefName: string;
  url: string;
  createdAt: string;
  state: string;
  body: string;
}

export interface WeeklyInputSources {
  root: string;
  // Where the journals are read: the weekly worktree, on origin/main.
  dir: string;
  week: string;
  // Monday to Sunday of the week, YYYY-MM-DD.
  days: string[];
  sessionsDir: string;
  // `git log` of main during the week, or the reason it is unavailable.
  commits: string;
  // From `gh pr list`, or the reason they are unavailable.
  pullRequests: PullRequest[] | string;
  // Rendered calendar of the next seven days, one entry per day.
  calendar: { day: string; text: string }[];
}

export function weekDays(sunday: string): string[] {
  const end = parseCivilDate(sunday);
  if (end === null) throw new Error(`invalid day "${sunday}"`);
  return Array.from({ length: 7 }, (_, index) => formatCivilDate(addCivilDays(end, index - 6)));
}

export async function buildWeeklyInput(sources: WeeklyInputSources): Promise<string> {
  const first = sources.days[0];
  const last = sources.days[sources.days.length - 1];
  const sections = [
    `# Weekly input\n\nWeek: ${sources.week} (${first} to ${last})`,
    await renderJournals(sources),
    renderDreamPullRequests(sources.pullRequests, sources.days),
    `## Commits on main\n\n~~~~\n${sources.commits.trim() || "None."}\n~~~~`,
    await renderSessions(sources),
    renderPreviousWeekly(sources.pullRequests, sources.week),
    renderCalendar(sources.calendar),
  ];
  return `${sections.join("\n\n")}\n`;
}

async function renderJournals({ dir, days }: WeeklyInputSources): Promise<string> {
  const parts = ["## Journals"];
  for (const day of days) {
    try {
      const text = await readFile(path.join(dir, "journal", `${day}.md`), "utf8");
      parts.push(`### ${day}\n\n~~~~md\n${text.trimEnd()}\n~~~~`);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      parts.push(`### ${day}\n\nNo journal.`);
    }
  }
  return parts.join("\n\n");
}

// A day is dreamed the next morning, so the week's dreams were opened Tuesday to the following Monday.
function renderDreamPullRequests(pullRequests: PullRequest[] | string, days: string[]): string {
  const heading = "## Dream PRs of the week";
  if (typeof pullRequests === "string") return `${heading}\n\nUnavailable: ${pullRequests}`;
  const from = days[1];
  const end = parseCivilDate(days[days.length - 1]);
  if (end === null) throw new Error("invalid week");
  const to = formatCivilDate(addCivilDays(end, 1));
  const parts = [heading];
  for (const pr of pullRequests) {
    if (!pr.headRefName.startsWith("dream/")) continue;
    const created = formatCivilDate(todayLocalCivilDate(new Date(pr.createdAt)));
    if (created < from || created > to) continue;
    parts.push(`### ${pr.url} · ${created} · ${pr.state.toLowerCase()}\n\n${pr.body.trim()}`);
  }
  if (parts.length === 1) parts.push("None.");
  return parts.join("\n\n");
}

async function renderSessions({ root, days, sessionsDir }: WeeklyInputSources): Promise<string> {
  const parts = ["## Janus sessions", "Read one with `pnpm brain:transcript -- <path>` only when a record leaves a question open."];
  let count = 0;
  for (const day of days) {
    const sessions = await listJanusSessions(root, day, sessionsDir);
    count += sessions.length;
    if (sessions.length === 0) continue;
    parts.push(`- ${day}: ${sessions.map(session => `${session.name ?? "(unnamed)"} (${session.path})`).join("; ")}`);
  }
  if (count === 0) parts.push("None.");
  return parts.join("\n\n");
}

function renderPreviousWeekly(pullRequests: PullRequest[] | string, week: string): string {
  const heading = "## Previous weekly review";
  if (typeof pullRequests === "string") return `${heading}\n\nUnavailable: ${pullRequests}`;
  const previous = pullRequests
    .filter(pr => pr.headRefName.startsWith("weekly/") && pr.headRefName.slice("weekly/".length, "weekly/".length + 8) < week)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (previous === undefined) return `${heading}\n\nNone.`;
  return `${heading}\n\n### ${previous.url} · ${previous.state.toLowerCase()}\n\n${previous.body.trim()}`;
}

function renderCalendar(calendar: { day: string; text: string }[]): string {
  const parts = ["## Next week's calendar"];
  for (const { day, text } of calendar) parts.push(`### ${day}\n\n${text.trim() || "Nothing scheduled."}`);
  return parts.join("\n\n");
}
