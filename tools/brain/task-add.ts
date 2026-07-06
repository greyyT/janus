import { addTaskToBacklog, deleteTaskCreateFile, normalizeProject, parseTaskCreateForm, readBacklog, renderNormalizedTaskCreateForm, resolveRepositoryRoot, todayLocalCivilDate, formatCivilDate, writeBacklog, type TaskEstimate, type TaskInput } from "./lib/index.js";
import { discoverProjectSlugs } from "./lib/filesystem.js";
import { readFile } from "node:fs/promises";
import path from "node:path";

interface Options extends TaskInput {
  dryRun: boolean;
  isJson: boolean;
  formPath?: string;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const repositoryRoot = await resolveRepositoryRoot();
    const projectSlugs = await discoverProjectSlugs(repositoryRoot);
    const input = options.formPath === undefined
      ? buildTaskInputFromArgs(options, projectSlugs)
      : await buildTaskInputFromForm(repositoryRoot, options.formPath);
    const backlog = await readBacklog(repositoryRoot);
    const result = addTaskToBacklog(backlog, input);
    if (!options.dryRun) await writeBacklog(repositoryRoot, result.content);
    if (!options.dryRun && options.formPath !== undefined) {
      await deleteTaskCreateFile(repositoryRoot, options.formPath);
    }

    const output = {
      action: options.dryRun ? "preview_add_task" : "added_task",
      task: { id: result.task.id, title: result.task.title, location: "backlog" },
      changed_paths: options.formPath === undefined || options.dryRun ? ["backlog.md"] : ["backlog.md", options.formPath],
      normalized_form: options.formPath === undefined ? undefined : renderNormalizedTaskCreateForm(input, projectSlugs),
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
    if (arg === "--form") options.formPath = requireValue(args, ++index, arg);
    else if (arg === "--project") options.project = requireValue(args, ++index, arg);
    else if (arg === "--title") options.title = requireValue(args, ++index, arg);
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

  if (options.formPath !== undefined && hasDirectTaskFields(options)) {
    throw new Error("--form cannot be combined with direct task fields");
  }
  if (options.formPath === undefined && options.title.trim().length === 0) throw new Error("--title is required");
  return options;
}

function buildTaskInputFromArgs(options: Options, projectSlugs: string[]): TaskInput {
  const errors: string[] = [];
  const task: TaskInput = {
    title: options.title,
    added: options.added,
    estimate: options.estimate,
    deadline: options.deadline,
    blockedBy: options.blockedBy,
    context: options.context,
    references: options.references,
  };

  if (options.project !== undefined) {
    task.project = normalizeProject(options.project, projectSlugs, errors);
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return task;
}

async function buildTaskInputFromForm(repositoryRoot: string, formPath: string): Promise<TaskInput> {
  const content = await readFile(path.join(repositoryRoot, formPath), "utf8");
  return {
    added: formatCivilDate(todayLocalCivilDate()),
    ...parseTaskCreateForm(content, await discoverProjectSlugs(repositoryRoot)).task,
  };
}

function parseEstimate(value: string): TaskEstimate {
  if (value === "quick" || value === "medium" || value === "large") return value;
  throw new Error(`invalid --estimate value "${value}"; expected quick, medium, or large`);
}

function hasDirectTaskFields(options: Options): boolean {
  return (
    options.title.trim().length > 0 ||
    options.project !== undefined ||
    options.estimate !== undefined ||
    options.deadline !== undefined ||
    options.blockedBy !== undefined ||
    options.context !== undefined ||
    options.references !== undefined
  );
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

await main();
