import { readFile } from "node:fs/promises";
import { readJanusTranscript, renderTranscript } from "./lib/index.js";

interface Options {
  transcript: string;
  isRaw: boolean;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.isRaw) {
      process.stdout.write(await readFile(options.transcript, "utf8"));
      return;
    }
    console.log(renderTranscript(await readJanusTranscript(options.transcript)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): Options {
  let transcript: string | undefined;
  let isRaw = false;
  for (const arg of args) {
    if (arg === "--") continue;
    if (arg === "--raw") isRaw = true;
    else if (arg.startsWith("--")) throw new Error(`unknown argument "${arg}"`);
    else if (transcript === undefined) transcript = arg;
    else throw new Error(`unexpected argument "${arg}"`);
  }
  if (transcript === undefined) throw new Error("usage: pnpm brain:transcript -- <transcript.jsonl> [--raw]");
  return { transcript, isRaw };
}

await main();
