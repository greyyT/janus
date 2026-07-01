import { addTaskToBacklog, readBacklog, resolveRepositoryRoot, todayLocalCivilDate, formatCivilDate, writeBacklog, type TaskEstimate, type TaskInput } from "./lib/index.js";

interface Options extends TaskInput {
  dryRun: boolean;
  isJson: boolean;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const repositoryRoot = await resolveRepositoryRoot();
    const backlog = await readBacklog(repositoryRoot);
    const result = addTaskToBacklog(backlog, options);
    if (!options.dryRun) await writeBacklog(repositoryRoot, result.content);

    const output = {
      action: options.dryRun ? "preview_add_task" : "added_task",
      task: { id: result.task.id, title: result.task.title, location: "backlog" },
      changed_paths: ["backlog.md"],
    };

    if (options.isJson) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(`${options.dryRun ? "Would add" : "Added"} ${result.task.id}: ${result.task.title}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    title: "",
    added: formatCivilDate(todayLocalCivilDate()),
    dryRun: false,
    isJson: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--title") options.title = requireValue(args, ++index, arg);
    else if (arg === "--added") options.added = requireValue(args, ++index, arg);
    else if (arg === "--estimate") options.estimate = parseEstimate(requireValue(args, ++index, arg));
    else if (arg === "--deadline") options.deadline = requireValue(args, ++index, arg);
    else if (arg === "--blocked-by") options.blockedBy = requireValue(args, ++index, arg);
    else if (arg === "--context") options.context = [...(options.context ?? []), requireValue(args, ++index, arg)];
    else if (arg === "--reference") options.references = [...(options.references ?? []), requireValue(args, ++index, arg)];
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--json") options.isJson = true;
    else throw new Error(`unknown argument "${arg}"`);
  }

  if (options.title.trim().length === 0) throw new Error("--title is required");
  return options;
}

function parseEstimate(value: string): TaskEstimate {
  if (value === "quick" || value === "medium" || value === "large") return value;
  throw new Error(`invalid --estimate value "${value}"; expected quick, medium, or large`);
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

await main();
