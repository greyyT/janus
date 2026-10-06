import { formatBookLookupHuman, lookupBookOnline, type BookLookupInput } from "./lib/index.js";

interface Options extends BookLookupInput {
  isJson: boolean;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await lookupBookOnline(options);
    if (options.isJson) console.log(JSON.stringify(result, null, 2));
    else console.log(formatBookLookupHuman(result, options.maxDepth).trimEnd());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): Options {
  const options: Options = { isJson: false, maxDepth: 4 };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--query") options.query = requireValue(args, ++index, arg);
    else if (arg === "--isbn") options.isbn = requireValue(args, ++index, arg);
    else if (arg === "--url") options.url = requireValue(args, ++index, arg);
    else if (arg === "--max-depth") options.maxDepth = requireInteger(requireValue(args, ++index, arg), arg);
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

function requireInteger(value: string, flag: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`${flag} requires an integer`);
  return Number.parseInt(value, 10);
}

await main();
