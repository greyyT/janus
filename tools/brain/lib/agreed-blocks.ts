import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseCivilDate, type CivilDate } from "./civil-date.js";

export interface AgreedBlock {
  label: string;
  owner: string;
  line: string;
  day_fixed: boolean;
}

// Commitment blocks are found by their label (`- C1-B1: ...`), not by section
// heading, so any commitment kind that reuses the label scheme is included.
// Times stay free-form text for the reader to interpret.
const BLOCK_PATTERN = /^\s*- (C\d+-B\d+):\s*(.*)$/;
const ISO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/;
const SOURCE_DIRECTORIES = ["tickets", path.join("brain", "reading")];

export async function loadAgreedBlocks(repositoryRoot: string, date: string): Promise<AgreedBlock[]> {
  const civilDate = parseCivilDate(date);
  if (civilDate === null) throw new Error(`invalid date "${date}"`);
  const week = isoWeekKey(civilDate);
  const blocks: AgreedBlock[] = [];

  for (const directory of SOURCE_DIRECTORIES) {
    const files = await listMarkdownFiles(path.join(repositoryRoot, directory));
    for (const file of files) {
      const content = await readFile(path.join(repositoryRoot, directory, file), "utf8");
      for (const rawLine of content.split("\n")) {
        const match = BLOCK_PATTERN.exec(rawLine);
        if (match === null) continue;
        const [, label, text] = match;
        if (!isPending(text)) continue;
        const hasDate = ISO_DATE_PATTERN.test(text);
        const isToday = hasDate && text.includes(date);
        const isThisWeek = !hasDate && text.includes(week);
        if (!isToday && !isThisWeek) continue;
        blocks.push({ label, owner: path.join(directory, file), line: text.trim(), day_fixed: isToday });
      }
    }
  }

  return blocks;
}

export function formatAgreedBlocksHuman(blocks: AgreedBlock[]): string {
  const fixed = blocks.filter((block) => block.day_fixed);
  const floating = blocks.filter((block) => !block.day_fixed);
  const lines = ["Agreed blocks (pending):"];
  if (fixed.length === 0) lines.push("- none");
  for (const block of fixed) lines.push(`- ${block.label} [${block.owner}] ${block.line}`);
  if (floating.length > 0) {
    lines.push("This week, day not fixed:");
    for (const block of floating) lines.push(`- ${block.label} [${block.owner}] ${block.line}`);
  }
  return lines.join("\n");
}

export function isoWeekKey(date: CivilDate): string {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const weekday = utc.getUTCDay() === 0 ? 7 : utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(utc.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((utc.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${week.toString().padStart(2, "0")}`;
}

function isPending(text: string): boolean {
  const result = /result:\s*([a-z]+)/i.exec(text);
  return result === null || result[1].toLowerCase() === "pending";
}

async function listMarkdownFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}
