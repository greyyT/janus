import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { formatCivilDate, parseCivilDate, todayLocalCivilDate, type CivilDate } from "./civil-date.js";
import { writeTextAtomically } from "./filesystem.js";
import {
  BACKLOG_RELATIVE_PATH,
  addTaskToBacklog,
  appendTaskBlocksToSection,
  ensureParentDirectory,
  extractSection,
  parseBacklog,
  parseTaskBlocks,
  readBacklog,
  removeTaskBlocks,
  replaceSection,
  splitLines,
  writeBacklog,
  type TaskInput,
} from "./backlog.js";

export type CarryoverDisposition = "recommit" | "return_to_backlog" | "complete" | "split" | "cancel";
export type TaskDestination = "today" | "backlog";

export interface TaskPlan {
  task_id: string;
  title?: string;
  done_for_today?: string;
  first_step?: string;
  steps?: string[];
  risks?: string[];
  stopping_point?: string;
}

export interface CheckinPlan {
  date: string;
  capacity?: string;
  primary_outcome?: string;
  calendar_summary?: string;
  constraints?: string;
  selected_task_ids?: string[];
  task_plans?: TaskPlan[];
  carryover?: CarryoverDecision[];
}

export type CarryoverDecision =
  | { task_id: string; from: string; disposition: "recommit" }
  | { task_id: string; from: string; disposition: "return_to_backlog" }
  | { task_id: string; from: string; disposition: "complete"; result?: string }
  | { task_id: string; from: string; disposition: "cancel"; reason?: string }
  | { task_id: string; from: string; disposition: "split"; children: SplitChild[] };

export interface SplitChild extends TaskInput {
  destination: TaskDestination;
}

export interface CheckoutPlan {
  date: string;
  completed_task_ids?: string[];
  wellbeing?: string;
  worked?: string;
  improve?: string;
  handoff?: string;
  next_step?: string;
  digest?: string[];
}

export interface MutationPreview {
  action: string;
  changed_paths: string[];
  details: Record<string, unknown>;
}

const TEMPLATE_RELATIVE_PATH = "templates/journal.md";

export async function ensureJournal(repositoryRoot: string, date: CivilDate | string): Promise<{ path: string; created: boolean; content: string }> {
  const dateKey = typeof date === "string" ? date : formatCivilDate(date);
  if (parseCivilDate(dateKey) === null) {
    throw new Error(`invalid journal date "${dateKey}"`);
  }

  const relativePath = `journal/${dateKey}.md`;
  const absolutePath = path.join(repositoryRoot, relativePath);
  try {
    await access(absolutePath);
    return { path: relativePath, created: false, content: await readFile(absolutePath, "utf8") };
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }

  const template = await readFile(path.join(repositoryRoot, TEMPLATE_RELATIVE_PATH), "utf8");
  const content = template.replaceAll("{{date:YYYY-MM-DD}}", dateKey);
  await ensureParentDirectory(absolutePath);
  await writeTextAtomically(absolutePath, content);
  return { path: relativePath, created: true, content };
}

async function readOrCreateJournal(repositoryRoot: string, dateKey: string, dryRun: boolean): Promise<{ path: string; created: boolean; content: string }> {
  if (!dryRun) return ensureJournal(repositoryRoot, dateKey);

  const relativePath = `journal/${dateKey}.md`;
  try {
    return { path: relativePath, created: false, content: await readFile(path.join(repositoryRoot, relativePath), "utf8") };
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }

  const template = await readFile(path.join(repositoryRoot, TEMPLATE_RELATIVE_PATH), "utf8");
  return { path: relativePath, created: true, content: template.replaceAll("{{date:YYYY-MM-DD}}", dateKey) };
}

export async function findLatestPriorJournalWithUnfinishedTasks(repositoryRoot: string, dateKey: string): Promise<{ path: string; content: string; tasks: string[] } | null> {
  const journalDirectory = path.join(repositoryRoot, "journal");
  let entries: string[];
  try {
    entries = await (await import("node:fs/promises")).readdir(journalDirectory);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }

  const priorDates = entries
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => entry.slice(0, -3))
    .filter((candidate) => parseCivilDate(candidate) !== null && candidate < dateKey)
    .sort()
    .reverse();

  for (const priorDate of priorDates) {
    const relativePath = `journal/${priorDate}.md`;
    const content = await readFile(path.join(repositoryRoot, relativePath), "utf8");
    const todo = extractSection(content, "## Todo");
    if (todo === null) continue;
    const tasks = parseTaskBlocks(todo, relativePath).tasks.filter((task) => !task.checked).map((task) => task.id);
    if (tasks.length > 0) return { path: relativePath, content, tasks };
  }

  return null;
}

export async function applyCheckinPlan(repositoryRoot: string, plan: CheckinPlan, options: { dryRun?: boolean } = {}): Promise<MutationPreview> {
  const date = parseRequiredDate(plan.date);
  const today = await readOrCreateJournal(repositoryRoot, formatCivilDate(date), options.dryRun === true);
  let todayContent = today.content;
  let backlogContent = await readBacklog(repositoryRoot);
  const changedPaths = new Set<string>();
  if (today.created) changedPaths.add(today.path);

  const selectedTaskIds = plan.selected_task_ids ?? [];
  if (selectedTaskIds.length > 0) {
    const removed = removeTaskBlocks(backlogContent, selectedTaskIds, BACKLOG_RELATIVE_PATH);
    backlogContent = removed.content;
    todayContent = appendTaskBlocksToSection(todayContent, "## Todo", removed.tasks.map((task) => task.lines));
    changedPaths.add(BACKLOG_RELATIVE_PATH);
    changedPaths.add(today.path);
  }

  for (const decision of plan.carryover ?? []) {
    const fromPath = normalizeJournalPath(decision.from);
    const fromContent = await readFile(path.join(repositoryRoot, fromPath), "utf8");
    const todo = extractSection(fromContent, "## Todo");
    if (todo === null) throw new Error(`${fromPath}: missing ## Todo section`);
    const removed = decision.disposition === "complete" || decision.disposition === "cancel" || decision.disposition === "split" || decision.disposition === "recommit" || decision.disposition === "return_to_backlog"
      ? removeTaskBlocks(todo, [decision.task_id], fromPath)
      : null;
    let updatedFromContent = fromContent;

    if (decision.disposition === "recommit") {
      todayContent = appendTaskBlocksToSection(todayContent, "## Todo", removed!.tasks.map((task) => task.lines));
      updatedFromContent = replaceSection(fromContent, "## Todo", splitLines(removed!.content));
      updatedFromContent = appendCheckoutAudit(updatedFromContent, `  - [${decision.task_id}] carried forward by /checkin on ${plan.date} and recommitted to that day`);
      changedPaths.add(today.path);
    } else if (decision.disposition === "return_to_backlog") {
      backlogContent = appendBlocksToBacklog(backlogContent, removed!.tasks.map((task) => task.lines));
      updatedFromContent = replaceSection(fromContent, "## Todo", splitLines(removed!.content));
      updatedFromContent = appendCheckoutAudit(updatedFromContent, `  - [${decision.task_id}] returned to backlog.md by /checkin on ${plan.date}`);
      changedPaths.add(BACKLOG_RELATIVE_PATH);
    } else if (decision.disposition === "complete") {
      const completedLines = removed!.tasks[0].lines.map((line, index) => index === 0 ? line.replace("- [ ]", "- [x]") : line);
      updatedFromContent = replaceSection(fromContent, "## Todo", [...splitLines(removed!.content), "", ...completedLines]);
      updatedFromContent = appendCheckoutAudit(updatedFromContent, `  - [${decision.task_id}] marked completed by /checkin on ${plan.date}${decision.result ? ` — ${decision.result}` : ""}`);
    } else if (decision.disposition === "cancel") {
      updatedFromContent = replaceSection(fromContent, "## Todo", splitLines(removed!.content));
      updatedFromContent = appendCheckoutAudit(updatedFromContent, `  - [${decision.task_id}] cancelled by /checkin on ${plan.date}${decision.reason ? ` — ${decision.reason}` : ""}`);
    } else {
      updatedFromContent = replaceSection(fromContent, "## Todo", splitLines(removed!.content));
      const childIds: string[] = [];
      for (const child of decision.children) {
        const added = addTaskToBacklog(backlogContent, child);
        backlogContent = added.content;
        childIds.push(added.task.id);
        if (child.destination === "today") {
          const childRemoved = removeTaskBlocks(backlogContent, [added.task.id], BACKLOG_RELATIVE_PATH);
          backlogContent = childRemoved.content;
          todayContent = appendTaskBlocksToSection(todayContent, "## Todo", childRemoved.tasks.map((task) => task.lines));
          changedPaths.add(today.path);
        }
        changedPaths.add(BACKLOG_RELATIVE_PATH);
      }
      updatedFromContent = appendCheckoutAudit(updatedFromContent, `  - [${decision.task_id}] split by /checkin on ${plan.date} into ${childIds.map((id) => `[${id}]`).join(" and ")}`);
    }

    if (!options.dryRun) await writeTextAtomically(path.join(repositoryRoot, fromPath), updatedFromContent);
    changedPaths.add(fromPath);
  }

  todayContent = writeCheckinSection(todayContent, plan);
  changedPaths.add(today.path);

  if (!options.dryRun) {
    await writeBacklog(repositoryRoot, backlogContent);
    await writeTextAtomically(path.join(repositoryRoot, today.path), todayContent);
  }

  return {
    action: options.dryRun ? "preview_checkin" : "applied_checkin",
    changed_paths: [...changedPaths].sort(),
    details: { date: plan.date, selected_task_ids: selectedTaskIds, carryover_count: plan.carryover?.length ?? 0 },
  };
}

export async function applyCheckoutPlan(repositoryRoot: string, plan: CheckoutPlan, options: { dryRun?: boolean } = {}): Promise<MutationPreview> {
  const date = parseRequiredDate(plan.date);
  const journal = await ensureJournal(repositoryRoot, date);
  let content = journal.content;
  const completedIds = new Set(plan.completed_task_ids ?? []);
  const todo = extractSection(content, "## Todo");
  if (todo !== null && completedIds.size > 0) {
    const parsed = parseTaskBlocks(todo, journal.path);
    const lines = splitLines(todo);
    for (const id of completedIds) {
      const task = parsed.tasks.find((candidate) => candidate.id === id);
      if (task === undefined) throw new Error(`${journal.path}: missing task ${id}`);
      lines[task.startLine - 1] = lines[task.startLine - 1].replace("- [ ]", "- [x]");
    }
    content = replaceSection(content, "## Todo", lines);
  }

  content = writeCheckoutSection(content, plan);
  if (!options.dryRun) await writeTextAtomically(path.join(repositoryRoot, journal.path), content);

  return {
    action: options.dryRun ? "preview_checkout" : "applied_checkout",
    changed_paths: [journal.path],
    details: { date: plan.date, completed_task_ids: [...completedIds].sort() },
  };
}

export function todayDateKey(): string {
  return formatCivilDate(todayLocalCivilDate());
}

function appendBlocksToBacklog(content: string, blocks: string[][]): string {
  const parsed = parseBacklog(content);
  const lines = [...parsed.lines];
  while (lines.length > 0 && lines.at(-1) === "") lines.pop();
  for (const block of blocks) {
    lines.push("", ...block);
  }
  return `${lines.join("\n")}\n`;
}

function writeCheckinSection(content: string, plan: CheckinPlan): string {
  const lines = [
    "",
    `- capacity: ${plan.capacity ?? ""}`,
    `- primary_outcome: ${plan.primary_outcome ?? ""}`,
    `- calendar_summary: ${plan.calendar_summary ?? ""}`,
    `- constraints: ${plan.constraints ?? ""}`,
  ];

  for (const taskPlan of plan.task_plans ?? []) {
    lines.push("", `### Plan: [${taskPlan.task_id}]${taskPlan.title ? ` ${taskPlan.title}` : ""}`, "");
    if (taskPlan.done_for_today !== undefined) lines.push(`- done_for_today: ${taskPlan.done_for_today}`);
    if (taskPlan.first_step !== undefined) lines.push(`- first_step: ${taskPlan.first_step}`);
    if (taskPlan.steps !== undefined && taskPlan.steps.length > 0) {
      lines.push("- steps:");
      taskPlan.steps.forEach((step, index) => lines.push(`  ${index + 1}. ${step}`));
    }
    if (taskPlan.risks !== undefined && taskPlan.risks.length > 0) {
      lines.push("- risks:");
      taskPlan.risks.forEach((risk) => lines.push(`  - ${risk}`));
    }
    if (taskPlan.stopping_point !== undefined) lines.push(`- stopping_point: ${taskPlan.stopping_point}`);
  }

  return replaceSection(content, "## Check-in", lines);
}

function writeCheckoutSection(content: string, plan: CheckoutPlan): string {
  const lines = [
    "",
    `- wellbeing: ${plan.wellbeing ?? ""}`,
    `- worked: ${plan.worked ?? ""}`,
    `- improve: ${plan.improve ?? ""}`,
    `- handoff: ${plan.handoff ?? ""}`,
    `- next_step: ${plan.next_step ?? ""}`,
    "- task_decisions:",
  ];
  for (const id of plan.completed_task_ids ?? []) lines.push(`  - [${id}] completed`);
  lines.push("- digest:");
  for (const digestLine of plan.digest ?? []) lines.push(`  - ${digestLine}`);
  return replaceSection(content, "## Checkout", lines);
}

function appendCheckoutAudit(content: string, line: string): string {
  const checkout = extractSection(content, "## Checkout");
  if (checkout === null) throw new Error("missing ## Checkout section");
  const lines = splitLines(checkout);
  const index = lines.findIndex((candidate) => candidate.trim() === "- task_decisions:");
  if (index === -1) {
    lines.push("- task_decisions:", line);
  } else {
    lines.splice(index + 1, 0, line);
  }
  return replaceSection(content, "## Checkout", lines);
}

function parseRequiredDate(dateKey: string): CivilDate {
  const date = parseCivilDate(dateKey);
  if (date === null) throw new Error(`invalid date "${dateKey}"`);
  return date;
}

function normalizeJournalPath(value: string): string {
  if (!value.startsWith("journal/") || !value.endsWith(".md")) {
    throw new Error(`invalid journal path "${value}"`);
  }
  return value;
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
