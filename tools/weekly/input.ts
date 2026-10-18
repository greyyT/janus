import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import {
  addCivilDays,
  formatCalendarHuman,
  formatCivilDate,
  loadCalendarDay,
  parseCivilDate,
  resolveRepositoryRoot,
  resolveSessionsDir,
} from "../brain/lib/index.js";
import { buildWeeklyInput, weekDays, type PullRequest } from "./lib/input.js";

const run = promisify(execFile);
const MAX_OUTPUT = 64 * 1024 * 1024;

// Prints everything the weekly review reads: `pnpm weekly:input -- --week 2026-W42 --sunday 2026-10-18`.
async function main(): Promise<void> {
  try {
    const { week, sunday, dir } = parseArgs(process.argv.slice(2));
    const root = await resolveRepositoryRoot();
    const days = weekDays(sunday);
    process.stdout.write(
      await buildWeeklyInput({
        root,
        dir: dir ?? root,
        week,
        days,
        sessionsDir: resolveSessionsDir(),
        commits: await commits(root, days),
        pullRequests: await pullRequests(root),
        calendar: await calendar(root, sunday),
      }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

async function commits(root: string, days: string[]): Promise<string> {
  try {
    const { stdout } = await run(
      "git",
      ["log", "origin/main", `--since=${days[0]} 00:00`, `--until=${days[6]} 23:59`, "--date=short", "--format=%h %ad %s", "--stat=100", "--stat-count=15"],
      { cwd: root, maxBuffer: MAX_OUTPUT },
    );
    return stdout;
  } catch (error) {
    return `git log failed: ${(error as Error).message}`;
  }
}

async function pullRequests(root: string): Promise<PullRequest[] | string> {
  try {
    const { stdout } = await run(
      "gh",
      ["pr", "list", "--state", "all", "--limit", "100", "--json", "headRefName,url,createdAt,state,body"],
      { cwd: root, maxBuffer: MAX_OUTPUT },
    );
    return JSON.parse(stdout) as PullRequest[];
  } catch (error) {
    return `gh pr list failed: ${(error as { stderr?: string }).stderr?.trim() || (error as Error).message}`;
  }
}

async function calendar(root: string, sunday: string): Promise<{ day: string; text: string }[]> {
  const end = parseCivilDate(sunday);
  if (end === null) throw new Error(`invalid --sunday "${sunday}"`);
  const result = [];
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = formatCivilDate(addCivilDays(end, offset));
    try {
      result.push({ day, text: formatCalendarHuman(await loadCalendarDay(root, day)) });
    } catch (error) {
      result.push({ day, text: `Unavailable: ${(error as Error).message}` });
    }
  }
  return result;
}

function parseArgs(args: string[]): { week: string; sunday: string; dir: string | null } {
  let week = "";
  let sunday = "";
  let dir: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    if (arg === "--") continue;
    if (arg === "--week" && value) week = value;
    else if (arg === "--sunday" && value) sunday = value;
    else if (arg === "--dir" && value) dir = path.resolve(value);
    else throw new Error(`unknown or incomplete argument "${arg}"`);
    index += 1;
  }
  if (!/^\d{4}-W\d{2}$/.test(week)) throw new Error("--week YYYY-Www is required");
  if (parseCivilDate(sunday) === null) throw new Error("--sunday YYYY-MM-DD is required");
  return { week, sunday, dir };
}

await main();
