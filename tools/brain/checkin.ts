import { buildCheckinReport, formatCheckinHuman } from "./lib/tracking.js";
import { parseCivilDate, todayLocalCivilDate } from "./lib/civil-date.js";
import { resolveRepositoryRoot } from "./lib/index.js";

interface CheckinOptions {
  days: number;
  to: ReturnType<typeof todayLocalCivilDate>;
  isJson: boolean;
}

const DEFAULT_DAYS = 7;

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const repositoryRoot = await resolveRepositoryRoot();
    const report = await buildCheckinReport(repositoryRoot, options.to, options.days);

    if (options.isJson) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(formatCheckinHuman(report));

    for (const warning of report.warnings) {
      console.error(`warning: ${warning.message}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): CheckinOptions {
  let days = DEFAULT_DAYS;
  let to = todayLocalCivilDate();
  let isJson = false;
  const seenFlags = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--json") {
      rejectRepeatedFlag(seenFlags, arg);
      isJson = true;
      continue;
    }

    if (arg === "--days") {
      rejectRepeatedFlag(seenFlags, arg);
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--days requires a positive integer");
      }
      days = parseDays(value);
      index += 1;
      continue;
    }

    if (arg === "--to") {
      rejectRepeatedFlag(seenFlags, arg);
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--to requires YYYY-MM-DD");
      }
      const parsed = parseCivilDate(value);
      if (parsed === null) {
        throw new Error(`invalid --to date "${value}"; expected YYYY-MM-DD`);
      }
      to = parsed;
      index += 1;
      continue;
    }

    throw new Error(`unknown argument "${arg}"`);
  }

  return { days, to, isJson };
}

function rejectRepeatedFlag(seenFlags: Set<string>, flag: string): void {
  if (seenFlags.has(flag)) {
    throw new Error(`repeated argument "${flag}"`);
  }

  seenFlags.add(flag);
}

function parseDays(value: string): number {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`invalid --days value "${value}"; expected a positive integer`);
  }

  const days = Number(value);
  if (!Number.isSafeInteger(days) || days <= 0) {
    throw new Error(`invalid --days value "${value}"; expected a positive integer`);
  }

  return days;
}

await main();
