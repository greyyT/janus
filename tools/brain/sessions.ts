import { listJanusSessions, parseCivilDate, resolveRepositoryRoot, resolveSessionsDir, todayDateKey } from "./lib/index.js";

interface Options {
  date: string;
  isJson: boolean;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const repositoryRoot = await resolveRepositoryRoot();
    const sessionsDir = resolveSessionsDir();
    const sessions = await listJanusSessions(repositoryRoot, options.date, sessionsDir);
    if (options.isJson) {
      console.log(JSON.stringify({ date: options.date, sessions_dir: sessionsDir, sessions }, null, 2));
      return;
    }
    if (sessions.length === 0) {
      console.log(`No Janus sessions on ${options.date} in ${sessionsDir}.`);
      return;
    }
    for (const session of sessions) {
      console.log(`${formatTime(session.firstActivity)}–${formatTime(session.lastActivity)}  ${session.name ?? "(unnamed)"}  ${session.path}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
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
