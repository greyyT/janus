import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  BACKLOG_RELATIVE_PATH,
  appendTaskBlocksToBacklog,
  appendTaskBlocksToSection,
  ensureJournal,
  extractSection,
  formatCivilDate,
  parseCivilDate,
  readBacklog,
  removeTaskBlocks,
  replaceSection,
  resolveRepositoryRoot,
  splitLines,
  todayLocalCivilDate,
  writeBacklog,
  writeTextAtomically,
  type TaskLocation,
} from "./lib/index.js";

interface Options {
  from: TaskLocation;
  to: TaskLocation;
  ids: string[];
  date: string;
  dryRun: boolean;
  isJson: boolean;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const repositoryRoot = await resolveRepositoryRoot();
    const result = await moveTasks(repositoryRoot, options);
    if (options.isJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`${options.dryRun ? "Would move" : "Moved"} ${options.ids.join(", ")} from ${options.from} to ${options.to}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

async function moveTasks(repositoryRoot: string, options: Options): Promise<{ action: string; changed_paths: string[]; task_ids: string[] }> {
  const sourcePath = resolveLocationPath(options.from, options.date);
  const destinationPath = resolveLocationPath(options.to, options.date);
  const sourceContent = await readContent(repositoryRoot, sourcePath, options.dryRun);
  const sourceScope = sourcePath === BACKLOG_RELATIVE_PATH ? sourceContent : extractSection(sourceContent, "## Todo");
  if (sourceScope === null) throw new Error(`${sourcePath}: missing ## Todo section`);

  const removed = removeTaskBlocks(sourceScope, options.ids, sourcePath);
  const updatedSource = sourcePath === BACKLOG_RELATIVE_PATH
    ? removed.content
    : replaceSection(sourceContent, "## Todo", splitLines(removed.content));

  const destinationContent = sourcePath === destinationPath ? updatedSource : await readContent(repositoryRoot, destinationPath, options.dryRun);
  const updatedDestination = destinationPath === BACKLOG_RELATIVE_PATH
    ? appendTaskBlocksToBacklog(destinationContent, removed.tasks.map((task) => task.lines))
    : appendTaskBlocksToSection(destinationContent, "## Todo", removed.tasks.map((task) => task.lines));

  if (!options.dryRun) {
    await writeContent(repositoryRoot, sourcePath, sourcePath === destinationPath ? updatedDestination : updatedSource);
    if (sourcePath !== destinationPath) await writeContent(repositoryRoot, destinationPath, updatedDestination);
  }

  return {
    action: options.dryRun ? "preview_move_tasks" : "moved_tasks",
    changed_paths: [...new Set([sourcePath, destinationPath])].sort(),
    task_ids: options.ids,
  };
}

function parseArgs(args: string[]): Options {
  const options: Partial<Options> = {
    ids: [],
    date: formatCivilDate(todayLocalCivilDate()),
    dryRun: false,
    isJson: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--from") options.from = parseLocation(requireValue(args, ++index, arg));
    else if (arg === "--to") options.to = parseLocation(requireValue(args, ++index, arg));
    else if (arg === "--date") options.date = requireDate(requireValue(args, ++index, arg));
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--json") options.isJson = true;
    else if (/^J-\d{3}$/u.test(arg)) options.ids = [...(options.ids ?? []), arg];
    else throw new Error(`unknown argument "${arg}"`);
  }

  if (options.from === undefined) throw new Error("--from is required");
  if (options.to === undefined) throw new Error("--to is required");
  if ((options.ids ?? []).length === 0) throw new Error("at least one task ID is required");

  return options as Options;
}

function parseLocation(value: string): TaskLocation {
  if (value === "backlog" || value === "today") return value;
  if (/^journal:\d{4}-\d{2}-\d{2}$/u.test(value) && parseCivilDate(value.slice("journal:".length)) !== null) return value as TaskLocation;
  throw new Error(`invalid task location "${value}"`);
}

function resolveLocationPath(location: TaskLocation, today: string): string {
  if (location === "backlog") return BACKLOG_RELATIVE_PATH;
  if (location === "today") return `journal/${today}.md`;
  return `journal/${location.slice("journal:".length)}.md`;
}

async function readContent(repositoryRoot: string, relativePath: string, dryRun: boolean): Promise<string> {
  if (relativePath === BACKLOG_RELATIVE_PATH) return readBacklog(repositoryRoot);
  if (!dryRun) return (await ensureJournal(repositoryRoot, relativePath.slice("journal/".length, -3))).content;
  try {
    return await readFile(path.join(repositoryRoot, relativePath), "utf8");
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }

  const dateKey = relativePath.slice("journal/".length, -3);
  const template = await readFile(path.join(repositoryRoot, "templates", "journal.md"), "utf8");
  return template.replaceAll("{{date:YYYY-MM-DD}}", dateKey);
}

async function writeContent(repositoryRoot: string, relativePath: string, content: string): Promise<void> {
  if (relativePath === BACKLOG_RELATIVE_PATH) await writeBacklog(repositoryRoot, content);
  else await writeTextAtomically(path.join(repositoryRoot, relativePath), content);
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function requireDate(value: string): string {
  if (parseCivilDate(value) === null) throw new Error(`invalid --date value "${value}"`);
  return value;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

await main();
