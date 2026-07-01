import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { compareDocumentPaths } from "./classify.js";
import { discoverJournalMarkdownFiles, writeTextAtomically } from "./filesystem.js";

export const BACKLOG_RELATIVE_PATH = "backlog.md";

export type TaskEstimate = "quick" | "medium" | "large";
export type TaskLocation = "backlog" | "today" | `journal:${string}`;

export interface TaskBlock {
  id: string;
  numericId: number;
  title: string;
  checked: boolean;
  startLine: number;
  endLine: number;
  lines: string[];
  location: string;
}

export interface ParsedBacklog {
  nextTaskId: number;
  tasks: TaskBlock[];
  lines: string[];
}

export interface TaskInput {
  title: string;
  added?: string;
  estimate?: TaskEstimate;
  deadline?: string;
  blockedBy?: string;
  context?: string[];
  references?: string[];
}

export interface ActiveTask extends TaskBlock {
  path: string;
}

const NEXT_TASK_ID_PATTERN = /^<!-- janus-backlog: next_task_id=([1-9][0-9]*) -->$/;
const TASK_LINE_PATTERN = /^- \[([ xX])\] .*$/;
const VALID_TASK_ID_PATTERN = /\[J-(\d{3})\]/g;
const ANY_TASK_ID_PATTERN = /\[J-[^\]]*\]/g;

export async function readBacklog(repositoryRoot: string): Promise<string> {
  return readFile(path.join(repositoryRoot, BACKLOG_RELATIVE_PATH), "utf8");
}

export function renderInitialBacklog(): string {
  return "# Backlog\n\n<!-- janus-backlog: next_task_id=1 -->\n";
}

export function parseBacklog(content: string, relativePath = BACKLOG_RELATIVE_PATH): ParsedBacklog {
  const lines = splitLines(content);
  const counterLine = lines.find((line) => NEXT_TASK_ID_PATTERN.test(line));

  if (counterLine === undefined) {
    throw new Error(`${relativePath}: missing valid janus backlog next_task_id comment`);
  }

  const counterMatch = NEXT_TASK_ID_PATTERN.exec(counterLine);
  if (counterMatch === null) {
    throw new Error(`${relativePath}: invalid janus backlog next_task_id comment`);
  }

  const nextTaskId = Number(counterMatch[1]);
  const starts = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => TASK_LINE_PATTERN.test(line));

  const seenIds = new Set<string>();
  const tasks = starts.map(({ line, index }, position) => {
    const ids = [...line.matchAll(VALID_TASK_ID_PATTERN)];
    const anyIds = line.match(ANY_TASK_ID_PATTERN) ?? [];

    if (anyIds.length !== ids.length) {
      throw new Error(`${relativePath}:${index + 1}: malformed task ID`);
    }

    if (ids.length !== 1) {
      throw new Error(`${relativePath}:${index + 1}: task line must contain exactly one task ID`);
    }

    const id = `J-${ids[0][1]}`;
    if (seenIds.has(id)) {
      throw new Error(`${relativePath}:${index + 1}: duplicate active task ID ${id}`);
    }
    seenIds.add(id);

    const endExclusive = starts[position + 1]?.index ?? lines.length;
    const blockLines = trimTrailingEmptyLines(lines.slice(index, endExclusive));
    const title = line.slice(ids[0].index! + ids[0][0].length).trim();

    return {
      id,
      numericId: Number(ids[0][1]),
      title,
      checked: line[3]?.toLowerCase() === "x",
      startLine: index + 1,
      endLine: index + blockLines.length,
      lines: blockLines,
      location: relativePath,
    } satisfies TaskBlock;
  });

  const maxTaskId = Math.max(0, ...tasks.map((task) => task.numericId));
  if (nextTaskId <= maxTaskId) {
    throw new Error(`${relativePath}: next_task_id ${nextTaskId} must be greater than existing max task ID ${maxTaskId}`);
  }

  return { nextTaskId, tasks, lines };
}

export function formatTaskId(numericId: number): string {
  return `J-${numericId.toString().padStart(3, "0")}`;
}

export function formatTaskBlock(id: string, input: TaskInput): string[] {
  const title = input.title.trim();
  if (title.length === 0) {
    throw new Error("task title is required");
  }

  const lines = [`- [ ] [${id}] ${title}`];
  if (input.added !== undefined && input.added.length > 0) lines.push(`  - added: ${input.added}`);
  if (input.estimate !== undefined) lines.push(`  - estimate: ${input.estimate}`);
  if (input.deadline !== undefined) lines.push(`  - deadline: ${input.deadline}`);
  if (input.blockedBy !== undefined) lines.push(`  - blocked_by: ${input.blockedBy}`);
  appendListField(lines, "context", input.context);
  appendListField(lines, "references", input.references);
  return lines;
}

export function addTaskToBacklog(content: string, input: TaskInput): { content: string; task: TaskBlock } {
  const parsed = parseBacklog(content);
  const id = formatTaskId(parsed.nextTaskId);
  const taskLines = formatTaskBlock(id, input);
  const updatedLines = parsed.lines.map((line) => {
    const match = NEXT_TASK_ID_PATTERN.exec(line);
    return match === null ? line : `<!-- janus-backlog: next_task_id=${parsed.nextTaskId + 1} -->`;
  });

  while (updatedLines.length > 0 && updatedLines.at(-1) === "") updatedLines.pop();
  if (updatedLines.length > 0) updatedLines.push("");
  updatedLines.push(...taskLines);

  const updatedContent = `${updatedLines.join("\n")}\n`;
  const updatedParsed = parseBacklog(updatedContent);
  const task = updatedParsed.tasks.find((candidate) => candidate.id === id);
  if (task === undefined) {
    throw new Error(`failed to add task ${id}`);
  }

  return { content: updatedContent, task };
}

export function removeTaskBlocks(content: string, ids: string[], relativePath: string): { content: string; tasks: TaskBlock[] } {
  const parsed = relativePath === BACKLOG_RELATIVE_PATH ? parseBacklog(content, relativePath) : parseTaskBlocks(content, relativePath);
  const idSet = new Set(ids);
  const tasks = parsed.tasks.filter((task) => idSet.has(task.id));

  if (tasks.length !== ids.length) {
    const found = new Set(tasks.map((task) => task.id));
    const missing = ids.filter((id) => !found.has(id));
    throw new Error(`${relativePath}: missing task(s) ${missing.join(", ")}`);
  }

  const removeLineNumbers = new Set<number>();
  for (const task of tasks) {
    for (let line = task.startLine; line <= task.endLine; line += 1) {
      removeLineNumbers.add(line);
    }
  }

  const lines = splitLines(content).filter((_line, index) => !removeLineNumbers.has(index + 1));
  return { content: `${trimOuterEmptyLines(lines).join("\n")}\n`, tasks };
}

export function appendTaskBlocksToBacklog(content: string, taskLines: string[][]): string {
  if (taskLines.length === 0) return content;
  const parsed = parseBacklog(content);
  const lines = [...parsed.lines];
  while (lines.length > 0 && lines.at(-1) === "") lines.pop();
  for (const block of taskLines) {
    lines.push("", ...block);
  }
  return `${lines.join("\n")}\n`;
}

export function appendTaskBlocksToSection(content: string, heading: string, taskLines: string[][]): string {
  if (taskLines.length === 0) return content;
  const lines = splitLines(content);
  const section = findSection(lines, heading);
  if (section === null) {
    throw new Error(`missing ${heading} section`);
  }

  const insertAt = section.end;
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  while (before.length > section.start + 1 && before.at(-1) === "") before.pop();
  before.push("");
  for (const block of taskLines) {
    before.push(...block, "");
  }
  if (after.length > 0 && after[0] === "") after.shift();
  return `${before.concat(after).join("\n").replace(/\n+$/u, "")}\n`;
}

export function parseTaskBlocks(content: string, relativePath: string): { tasks: TaskBlock[]; lines: string[] } {
  const lines = splitLines(content);
  const starts = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => TASK_LINE_PATTERN.test(line));
  const seenIds = new Set<string>();

  const tasks = starts.flatMap(({ line, index }, position) => {
    const ids = [...line.matchAll(VALID_TASK_ID_PATTERN)];
    const anyIds = line.match(ANY_TASK_ID_PATTERN) ?? [];
    if (anyIds.length === 0) return [];
    if (anyIds.length !== ids.length) {
      throw new Error(`${relativePath}:${index + 1}: malformed task ID`);
    }
    if (ids.length !== 1) {
      throw new Error(`${relativePath}:${index + 1}: task line must contain exactly one task ID`);
    }
    const id = `J-${ids[0][1]}`;
    if (seenIds.has(id)) {
      throw new Error(`${relativePath}:${index + 1}: duplicate active task ID ${id}`);
    }
    seenIds.add(id);

    const endExclusive = starts[position + 1]?.index ?? lines.length;
    const blockLines = trimTrailingEmptyLines(lines.slice(index, endExclusive));
    const title = line.slice(ids[0].index! + ids[0][0].length).trim();
    return [{
      id,
      numericId: Number(ids[0][1]),
      title,
      checked: line[3]?.toLowerCase() === "x",
      startLine: index + 1,
      endLine: index + blockLines.length,
      lines: blockLines,
      location: relativePath,
    } satisfies TaskBlock];
  });

  return { tasks, lines };
}

export async function listActiveTasks(repositoryRoot: string): Promise<ActiveTask[]> {
  const backlogContent = await readBacklog(repositoryRoot);
  const backlogTasks = parseBacklog(backlogContent).tasks.map((task) => ({ ...task, path: BACKLOG_RELATIVE_PATH }));
  const journals = await discoverJournalMarkdownFiles(repositoryRoot);
  const journalTasks = await Promise.all(journals.map(async (file) => {
    const content = await readFile(file.absolutePath, "utf8");
    const todoContent = extractSection(content, "## Todo");
    if (todoContent === null) return [];
    return parseTaskBlocks(todoContent, file.relativePath).tasks
      .filter((task) => !task.checked)
      .map((task) => ({ ...task, path: file.relativePath }));
  }));

  return [...backlogTasks, ...journalTasks.flat()].sort((a, b) => compareDocumentPaths(`${a.path}:${a.id}`, `${b.path}:${b.id}`));
}

export async function writeBacklog(repositoryRoot: string, content: string): Promise<void> {
  await writeTextAtomically(path.join(repositoryRoot, BACKLOG_RELATIVE_PATH), content);
}

export async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export function extractSection(content: string, heading: string): string | null {
  const lines = splitLines(content);
  const section = findSection(lines, heading);
  if (section === null) return null;
  return lines.slice(section.start + 1, section.end).join("\n");
}

export function replaceSection(content: string, heading: string, bodyLines: string[]): string {
  const lines = splitLines(content);
  const section = findSection(lines, heading);
  if (section === null) {
    throw new Error(`missing ${heading} section`);
  }
  const updated = [...lines.slice(0, section.start + 1), ...bodyLines, ...lines.slice(section.end)];
  return `${updated.join("\n").replace(/\n+$/u, "")}\n`;
}

export function splitLines(content: string): string[] {
  const normalized = content.replace(/\r\n/gu, "\n");
  const lines = normalized.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function appendListField(lines: string[], field: string, values: string[] | undefined): void {
  if (values === undefined || values.length === 0) return;
  lines.push(`  - ${field}:`);
  for (const value of values) {
    for (const line of value.split("\n")) {
      lines.push(`    - ${line}`);
    }
  }
}

function findSection(lines: string[], heading: string): { start: number; end: number } | null {
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return null;
  const end = lines.findIndex((line, index) => index > start && /^##\s+/u.test(line));
  return { start, end: end === -1 ? lines.length : end };
}

function trimTrailingEmptyLines(lines: string[]): string[] {
  const trimmed = [...lines];
  while (trimmed.length > 0 && trimmed.at(-1) === "") trimmed.pop();
  return trimmed;
}

function trimOuterEmptyLines(lines: string[]): string[] {
  const trimmed = [...lines];
  while (trimmed.length > 0 && trimmed[0] === "") trimmed.shift();
  while (trimmed.length > 0 && trimmed.at(-1) === "") trimmed.pop();
  return trimmed;
}
