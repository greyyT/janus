import { type CivilDate, addCivilDays, buildInclusiveDateWindow, formatCivilDate } from "./civil-date.js";
import { keyJournalFilesByDate, loadValidJournalFiles, type JournalFile } from "./journal.js";

export const WELLBEING_METRIC = {
  key: "wellbeing",
  label: "Wellbeing",
  min: 1,
  max: 5,
} as const;

export interface TrackingWarning {
  code: "invalid_wellbeing_value" | "duplicate_wellbeing_value";
  message: string;
}

export interface ParsedCheckin {
  score: number | null;
  warnings: TrackingWarning[];
}

export interface CheckinEntry {
  date: string;
  path: string;
  score: number;
}

export interface CheckinSummary {
  count: number;
  mean: number;
  min: number;
  max: number;
}

export interface CheckinReport {
  metric: "wellbeing";
  scale: {
    min: number;
    max: number;
  };
  from: string;
  to: string;
  calendar_days: number;
  days_with_journal: number;
  recorded_days: number;
  entries: CheckinEntry[];
  summary: CheckinSummary | null;
  warnings: TrackingWarning[];
}

interface WellbeingOccurrence {
  line: number;
  value: string;
}

const CHECKIN_HEADING = "## Check-in";
const H2_HEADING_PATTERN = /^##\s+/;
const WELLBEING_LINE_PATTERN = /^-[ \t]+wellbeing[ \t]*:[ \t]*(.*?)[ \t]*$/;
const INTEGER_PATTERN = /^[0-9]+$/;

export function parseCheckin(content: string, relativePath: string): ParsedCheckin {
  const lines = splitLines(content);
  const checkinStart = lines.findIndex((line) => line === CHECKIN_HEADING);

  if (checkinStart === -1) {
    return { score: null, warnings: [] };
  }

  const occurrences: WellbeingOccurrence[] = [];

  for (let index = checkinStart + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (H2_HEADING_PATTERN.test(line)) {
      break;
    }

    const match = WELLBEING_LINE_PATTERN.exec(line);
    if (match === null) {
      continue;
    }

    occurrences.push({ line: index + 1, value: match[1] ?? "" });
  }

  const warnings: TrackingWarning[] = [];
  const validScores: number[] = [];

  for (const occurrence of occurrences) {
    const value = occurrence.value.trim();
    if (value === "") {
      continue;
    }

    if (!INTEGER_PATTERN.test(value)) {
      warnings.push({
        code: "invalid_wellbeing_value",
        message: `${relativePath}: line ${occurrence.line}: wellbeing value must be an integer between 1 and 5`,
      });
      continue;
    }

    const score = Number(value);
    if (score < WELLBEING_METRIC.min || score > WELLBEING_METRIC.max) {
      warnings.push({
        code: "invalid_wellbeing_value",
        message: `${relativePath}: line ${occurrence.line}: wellbeing value ${score} is outside 1..5`,
      });
      continue;
    }

    validScores.push(score);
  }

  if (validScores.length > 1) {
    warnings.push({
      code: "duplicate_wellbeing_value",
      message: `${relativePath}: multiple valid wellbeing values; last valid value wins`,
    });
  }

  return {
    score: validScores.at(-1) ?? null,
    warnings,
  };
}

export async function buildCheckinReport(repositoryRoot: string, to: CivilDate, days: number): Promise<CheckinReport> {
  const dateWindow = buildInclusiveDateWindow(to, days);
  const journalsByDate = keyJournalFilesByDate(await loadValidJournalFiles(repositoryRoot));
  const entries: CheckinEntry[] = [];
  const warnings: TrackingWarning[] = [];
  let daysWithJournal = 0;

  for (const date of dateWindow) {
    const dateKey = formatCivilDate(date);
    const journal = journalsByDate.get(dateKey);

    if (journal === undefined) {
      continue;
    }

    daysWithJournal += 1;
    const parsed = parseJournalCheckin(journal);
    warnings.push(...parsed.warnings);

    if (parsed.score !== null) {
      entries.push({
        date: dateKey,
        path: journal.relativePath,
        score: parsed.score,
      });
    }
  }

  return {
    metric: WELLBEING_METRIC.key,
    scale: {
      min: WELLBEING_METRIC.min,
      max: WELLBEING_METRIC.max,
    },
    from: formatCivilDate(dateWindow[0] ?? to),
    to: formatCivilDate(to),
    calendar_days: days,
    days_with_journal: daysWithJournal,
    recorded_days: entries.length,
    entries,
    summary: summarizeScores(entries.map((entry) => entry.score)),
    warnings,
  };
}

export function formatCheckinHuman(report: CheckinReport): string {
  const entryByDate = new Map(report.entries.map((entry) => [entry.date, entry.score]));
  const lines = [
    `${WELLBEING_METRIC.label} check-in — ${report.from} to ${report.to}`,
    "",
  ];

  for (const date of buildInclusiveDateWindowFromKeys(report.from, report.to)) {
    const dateKey = formatCivilDate(date);
    lines.push(`${dateKey}  ${entryByDate.get(dateKey) ?? "—"}`);
  }

  lines.push("", `Recorded: ${report.recorded_days}/${report.calendar_days} days`);

  if (report.summary === null) {
    lines.push("Average: —", "Range: —");
  } else {
    lines.push(`Average: ${report.summary.mean.toFixed(1)}`, `Range: ${report.summary.min}–${report.summary.max}`);
  }

  return lines.join("\n");
}

function parseJournalCheckin(journal: JournalFile): ParsedCheckin {
  return parseCheckin(journal.content, journal.relativePath);
}

function summarizeScores(scores: number[]): CheckinSummary | null {
  if (scores.length === 0) {
    return null;
  }

  const sum = scores.reduce((total, score) => total + score, 0);
  return {
    count: scores.length,
    mean: Math.round((sum / scores.length) * 10) / 10,
    min: Math.min(...scores),
    max: Math.max(...scores),
  };
}

function buildInclusiveDateWindowFromKeys(from: string, to: string): CivilDate[] {
  const fromDate = parseDateKey(from);
  const toDate = parseDateKey(to);
  const dates: CivilDate[] = [];

  for (let date = fromDate; formatCivilDate(date) <= formatCivilDate(toDate); date = addOneDay(date)) {
    dates.push(date);
  }

  return dates;
}

function addOneDay(date: CivilDate): CivilDate {
  return addCivilDays(date, 1);
}

function parseDateKey(value: string): CivilDate {
  const parsed = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  if (parsed === null) {
    throw new Error(`Invalid report date ${value}`);
  }

  return {
    year: Number(parsed[1]),
    month: Number(parsed[2]),
    day: Number(parsed[3]),
  };
}

function splitLines(content: string): string[] {
  return content.split("\n").map((line) => line.endsWith("\r") ? line.slice(0, -1) : line);
}
