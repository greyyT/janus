import { formatCalendarHuman, loadCalendarDay, parseCivilDate, resolveRepositoryRoot, todayDateKey } from "./lib/index.js";

interface Options {
  date: string;
  isJson: boolean;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const repositoryRoot = await resolveRepositoryRoot();
    const output = await loadCalendarDay(repositoryRoot, options.date);
    if (options.isJson) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    console.log(formatCalendarHuman(output));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): Options {
  const options: Options = { date: todayDateKey(), isJson: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--date") options.date = requireDate(requireValue(args, ++index, arg));
    else if (arg === "--json") options.isJson = true;
    else throw new Error(`unknown argument "${arg}"`);
  }
  return options;
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
