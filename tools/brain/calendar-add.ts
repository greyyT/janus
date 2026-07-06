import { addCalendarSubscription, resolveRepositoryRoot } from "./lib/index.js";

interface Options {
  url?: string;
  name?: string;
  timezone?: string;
  isJson: boolean;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.url === undefined) throw new Error("--url is required");

    const repositoryRoot = await resolveRepositoryRoot();
    const result = await addCalendarSubscription(repositoryRoot, {
      url: options.url,
      name: options.name,
      timezone: options.timezone,
    });

    if (options.isJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.action === "calendar_already_configured") {
      console.log(`Calendar "${result.calendar.name}" already configured`);
      return;
    }

    console.log(`Added calendar "${result.calendar.name}" to ${result.config_path}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): Options {
  const options: Options = { isJson: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--url") options.url = requireValue(args, ++index, arg);
    else if (arg === "--name") options.name = requireValue(args, ++index, arg);
    else if (arg === "--timezone") options.timezone = requireValue(args, ++index, arg);
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
