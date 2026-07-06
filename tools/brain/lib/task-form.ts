import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { writeTextAtomically, discoverProjectSlugs } from "./filesystem.js";
import { parseFrontmatter } from "./frontmatter.js";
import { type TaskEstimate, type TaskInput } from "./backlog.js";

export const TASK_CREATE_RELATIVE_PATH = "task-create.md";
const ALLOWED_FRONTMATTER_KEYS = new Set(["title", "project", "estimate", "deadline", "blocked_by"]);
const ESTIMATE_VALUES = new Set<TaskEstimate>(["quick", "medium", "large"]);

export interface TaskCreateForm {
  task: TaskInput;
  normalizedContent: string;
  projectSlugs: string[];
}

export interface TaskCreateInitializationResult {
  action: "created" | "resumed";
  path: string;
  projectSlugs: string[];
}

export async function initializeTaskCreateFile(repositoryRoot: string): Promise<TaskCreateInitializationResult> {
  const projectSlugs = await discoverProjectSlugs(repositoryRoot);
  const absolutePath = path.join(repositoryRoot, TASK_CREATE_RELATIVE_PATH);

  if (await pathExists(absolutePath)) {
    return {
      action: "resumed",
      path: TASK_CREATE_RELATIVE_PATH,
      projectSlugs,
    };
  }

  await writeTextAtomically(absolutePath, renderTaskCreateTemplate(projectSlugs));

  return {
    action: "created",
    path: TASK_CREATE_RELATIVE_PATH,
    projectSlugs,
  };
}

export async function readTaskCreateForm(repositoryRoot: string, relativePath = TASK_CREATE_RELATIVE_PATH): Promise<TaskCreateForm> {
  const absolutePath = path.join(repositoryRoot, relativePath);
  const content = await readFile(absolutePath, "utf8");
  const projectSlugs = await discoverProjectSlugs(repositoryRoot);
  return parseTaskCreateForm(content, projectSlugs);
}

export async function deleteTaskCreateFile(repositoryRoot: string, relativePath = TASK_CREATE_RELATIVE_PATH): Promise<void> {
  await rm(path.join(repositoryRoot, relativePath), { force: true });
}

export function renderTaskCreateTemplate(projectSlugs: string[]): string {
  const projectHint = projectSlugs.length === 0 ? "(none found)" : projectSlugs.join(", ");

  return [
    "---",
    "title:",
    "project:",
    "estimate:",
    "deadline:",
    "blocked_by:",
    "---",
    "",
    "# Task Create",
    "",
    "Fill this file, then reply `done`.",
    "",
    `Known project slugs: ${projectHint}`,
    "",
    "## Context",
    "",
    "- ",
    "",
    "## References",
    "",
    "- ",
    "",
  ].join("\n");
}

export function parseTaskCreateForm(content: string, projectSlugs: string[]): TaskCreateForm {
  const parsed = parseFrontmatter(content);
  const errors = parsed.warnings.map((warning) => warning.line === undefined ? warning.message : `line ${warning.line}: ${warning.message}`);
  const unknownKeys = Object.keys(parsed.frontmatter).filter((key) => !ALLOWED_FRONTMATTER_KEYS.has(key));

  for (const key of unknownKeys) {
    errors.push(`unsupported field "${key}"`);
  }

  const title = (parsed.frontmatter.title ?? "").trim();
  if (title.length === 0) {
    errors.push('task-create.md: missing required "title"');
  }

  const project = normalizeProject(parsed.frontmatter.project, projectSlugs, errors);
  const estimate = normalizeEstimate(parsed.frontmatter.estimate, errors);
  const deadline = normalizeOptionalText(parsed.frontmatter.deadline);
  const blockedBy = normalizeOptionalText(parsed.frontmatter.blocked_by);

  const sections = parseListSections(parsed.body, errors);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const task: TaskInput = { title };
  if (project !== undefined) task.project = project;
  if (estimate !== undefined) task.estimate = estimate;
  if (deadline !== undefined) task.deadline = deadline;
  if (blockedBy !== undefined) task.blockedBy = blockedBy;
  if (sections.context.length > 0) task.context = sections.context;
  if (sections.references.length > 0) task.references = sections.references;

  return {
    task,
    normalizedContent: renderNormalizedTaskCreateForm(task, projectSlugs),
    projectSlugs,
  };
}

export function renderNormalizedTaskCreateForm(task: TaskInput, projectSlugs: string[]): string {
  const projectHint = projectSlugs.length === 0 ? "(none found)" : projectSlugs.join(", ");
  const context = task.context?.length ? task.context : [""];
  const references = task.references?.length ? task.references : [""];

  return [
    "---",
    `title: ${task.title}`,
    `project: ${task.project ?? ""}`,
    `estimate: ${task.estimate ?? ""}`,
    `deadline: ${task.deadline ?? ""}`,
    `blocked_by: ${task.blockedBy ?? ""}`,
    "---",
    "",
    "# Task Create",
    "",
    "Fill this file, then reply `done`.",
    "",
    `Known project slugs: ${projectHint}`,
    "",
    "## Context",
    "",
    ...context.map((line) => `- ${line}`),
    "",
    "## References",
    "",
    ...references.map((line) => `- ${line}`),
    "",
  ].join("\n");
}

export function normalizeProject(value: string | undefined, projectSlugs: string[], errors: string[]): string | undefined {
  const normalized = normalizeOptionalText(value);
  if (normalized === undefined) {
    return undefined;
  }

  const match = projectSlugs.find((slug) => slug.toLowerCase() === normalized.toLowerCase());
  if (match !== undefined) {
    return match;
  }

  errors.push(`invalid project "${normalized}"; expected one of: ${projectSlugs.join(", ") || "(none available)"}`);
  return undefined;
}

function normalizeEstimate(value: string | undefined, errors: string[]): TaskEstimate | undefined {
  const normalized = normalizeOptionalText(value);
  if (normalized === undefined) {
    return undefined;
  }

  if (ESTIMATE_VALUES.has(normalized as TaskEstimate)) {
    return normalized as TaskEstimate;
  }

  errors.push(`invalid estimate "${normalized}"; expected quick, medium, or large`);
  return undefined;
}

function parseListSections(body: string, errors: string[]): { context: string[]; references: string[] } {
  const lines = body.replace(/\r\n/gu, "\n").split("\n");
  const sections = new Map<string, string[]>();
  let currentSection: "context" | "references" | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line === "## Context") {
      currentSection = "context";
      sections.set(currentSection, []);
      continue;
    }
    if (line === "## References") {
      currentSection = "references";
      sections.set(currentSection, []);
      continue;
    }
    if (line.startsWith("## ")) {
      currentSection = null;
      continue;
    }
    if (currentSection === null) {
      continue;
    }
    if (line.trim() === "") {
      continue;
    }
    if (!line.startsWith("- ")) {
      errors.push(`invalid ${currentSection} entry "${line.trim()}"; expected "- value"`);
      continue;
    }

    const value = line.slice(2).trim();
    if (value.length === 0) {
      continue;
    }

    sections.get(currentSection)?.push(value);
  }

  if (!sections.has("context")) {
    errors.push('task-create.md: missing required "## Context" section');
  }
  if (!sections.has("references")) {
    errors.push('task-create.md: missing required "## References" section');
  }

  return {
    context: sections.get("context") ?? [],
    references: sections.get("references") ?? [],
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized === "" ? undefined : normalized;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
