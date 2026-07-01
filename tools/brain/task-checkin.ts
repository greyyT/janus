import { readFile } from "node:fs/promises";
import { applyCheckinPlan, resolveRepositoryRoot, type CheckinPlan } from "./lib/index.js";

interface Options {
  planPath?: string;
  planJson?: string;
  dryRun: boolean;
  isJson: boolean;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const repositoryRoot = await resolveRepositoryRoot();
    const plan = await readPlan(options);
    const result = await applyCheckinPlan(repositoryRoot, plan, { dryRun: options.dryRun });

    if (options.isJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`${options.dryRun ? "Would apply" : "Applied"} check-in plan for ${plan.date}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): Options {
  const options: Options = { dryRun: false, isJson: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--plan") options.planPath = requireValue(args, ++index, arg);
    else if (arg === "--plan-json") options.planJson = requireValue(args, ++index, arg);
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--json") options.isJson = true;
    else throw new Error(`unknown argument "${arg}"`);
  }
  if (options.planPath === undefined && options.planJson === undefined) throw new Error("--plan or --plan-json is required");
  if (options.planPath !== undefined && options.planJson !== undefined) throw new Error("use only one of --plan or --plan-json");
  return options;
}

async function readPlan(options: Options): Promise<CheckinPlan> {
  const raw = options.planJson ?? await readFile(options.planPath!, "utf8");
  const parsed = JSON.parse(raw) as Partial<CheckinPlan>;
  if (typeof parsed.date !== "string") throw new Error("check-in plan requires date");
  return parsed as CheckinPlan;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

await main();
