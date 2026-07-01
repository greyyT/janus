import { applyCheckoutPlan, formatCivilDate, resolveRepositoryRoot, todayLocalCivilDate, type CheckoutPlan } from "./lib/index.js";

interface Options extends CheckoutPlan {
  dryRun: boolean;
  isJson: boolean;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const repositoryRoot = await resolveRepositoryRoot();
    const result = await applyCheckoutPlan(repositoryRoot, options, { dryRun: options.dryRun });

    if (options.isJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`${options.dryRun ? "Would apply" : "Applied"} checkout for ${options.date}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    date: formatCivilDate(todayLocalCivilDate()),
    dryRun: false,
    isJson: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--date") options.date = requireValue(args, ++index, arg);
    else if (arg === "--completed") options.completed_task_ids = [...(options.completed_task_ids ?? []), requireValue(args, ++index, arg)];
    else if (arg === "--wellbeing") options.wellbeing = requireValue(args, ++index, arg);
    else if (arg === "--worked") options.worked = requireValue(args, ++index, arg);
    else if (arg === "--improve") options.improve = requireValue(args, ++index, arg);
    else if (arg === "--handoff") options.handoff = requireValue(args, ++index, arg);
    else if (arg === "--next-step") options.next_step = requireValue(args, ++index, arg);
    else if (arg === "--digest") options.digest = [...(options.digest ?? []), requireValue(args, ++index, arg)];
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--json") options.isJson = true;
    else throw new Error(`unknown argument "${arg}"`);
  }

  return options;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

await main();
