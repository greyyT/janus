import { ensureJournal, formatCivilDate, resolveRepositoryRoot, todayLocalCivilDate } from "./lib/index.js";

interface Options {
  date: string;
  isJson: boolean;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const repositoryRoot = await resolveRepositoryRoot();
    const journal = await ensureJournal(repositoryRoot, options.date);
    const result = {
      action: journal.created ? "created_journal" : "opened_journal",
      path: journal.path,
      created: journal.created,
    };

    if (options.isJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`${journal.created ? "Created" : "Opened"} ${journal.path}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): Options {
  const options: Options = { date: formatCivilDate(todayLocalCivilDate()), isJson: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--date") options.date = requireValue(args, ++index, arg);
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
