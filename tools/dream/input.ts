import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import {
  addCivilDays,
  formatCivilDate,
  parseCivilDate,
  resolveRepositoryRoot,
  resolveSessionsDir,
  todayLocalCivilDate,
} from "../brain/lib/index.js";
import { buildDreamInput, type DreamPullRequest } from "./lib/input.js";

const run = promisify(execFile);
const MAX_OUTPUT = 64 * 1024 * 1024;

interface Options {
  days: string[];
  changes: string | null;
  notesDir: string | null;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const root = await resolveRepositoryRoot();
    process.stdout.write(
      await buildDreamInput({
        root,
        days: options.days,
        notesDir: options.notesDir ?? root,
        sessionsDir: resolveSessionsDir(),
        changes: options.changes === null ? null : await gitShow(root, options.changes),
        pullRequests: await dreamPullRequests(root),
      }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

async function gitShow(root: string, commit: string): Promise<string> {
  const { stdout } = await run("git", ["show", "--stat", "--patch", "--format=%h %s", commit], { cwd: root, maxBuffer: MAX_OUTPUT });
  return stdout;
}

async function dreamPullRequests(root: string): Promise<DreamPullRequest[] | string> {
  try {
    const { stdout } = await run(
      "gh",
      ["pr", "list", "--state", "all", "--limit", "100", "--json", "headRefName,url,createdAt,state,body"],
      { cwd: root, maxBuffer: MAX_OUTPUT },
    );
    return JSON.parse(stdout) as DreamPullRequest[];
  } catch (error) {
    return `gh pr list failed: ${(error as { stderr?: string }).stderr?.trim() || (error as Error).message}`;
  }
}

// A day is dreamed after 03:00 the next morning (tools/dream/dream.sh).
function latestDreamDay(): string {
  return formatCivilDate(addCivilDays(todayLocalCivilDate(new Date(Date.now() - 3 * 60 * 60 * 1000)), -1));
}

function parseArgs(args: string[]): Options {
  const options: Options = { days: [latestDreamDay()], changes: null, notesDir: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--days") options.days = parseDays(requireValue(args, ++index, arg));
    else if (arg === "--changes") options.changes = requireValue(args, ++index, arg);
    else if (arg === "--notes-dir") options.notesDir = path.resolve(requireValue(args, ++index, arg));
    else throw new Error(`unknown argument "${arg}"`);
  }
  return options;
}

function parseDays(value: string): string[] {
  const days = value.split(/[\s,]+/).filter(Boolean);
  const invalid = days.find(day => parseCivilDate(day) === null);
  if (days.length === 0 || invalid !== undefined) throw new Error(`invalid --days value "${value}"`);
  return days;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

await main();
