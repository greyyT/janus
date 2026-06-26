import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { classifyPath, compareDocumentPaths, type LocationClass } from "./classify.js";
import { parseCivilDate } from "./civil-date.js";
import { discoverMarkdownFiles, discoverRootMarkdownFiles, type DiscoveredMarkdownFile } from "./filesystem.js";
import { type FrontmatterWarning, parseFrontmatter } from "./frontmatter.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type DocumentWarningCode =
  | "invalid_journal_filename"
  | "invalid_journal_date"
  | "malformed_frontmatter"
  | "duplicate_frontmatter_key"
  | "invalid_created_date";

export interface DocumentWarning {
  code: DocumentWarningCode;
  message: string;
}

export interface BrainDocument {
  path: string;
  location_class: LocationClass;
  title: string;
  frontmatter: Record<string, string>;
  content_hash: string;
  warnings: DocumentWarning[];
}

export interface InboxDocument {
  path: string;
  title: string;
  project?: string;
  age_days: number;
  age_source: "created" | "filesystem_mtime";
  frontmatter_warnings: string[];
}

export interface LoadedDocument {
  document: BrainDocument;
  mtime: Date;
  frontmatterWarnings: string[];
}

export async function loadBrainDocuments(repositoryRoot: string): Promise<LoadedDocument[]> {
  const files = await discoverMarkdownFiles(repositoryRoot);
  const documents = await Promise.all(files.map(loadBrainDocument));

  return documents
    .filter((document): document is LoadedDocument => document !== null)
    .sort((a, b) => compareDocumentPaths(a.document.path, b.document.path));
}

export async function listInboxDocuments(repositoryRoot: string, now = new Date()): Promise<InboxDocument[]> {
  const files = await discoverRootMarkdownFiles(repositoryRoot);
  const documents = await Promise.all(files.map(loadBrainDocument));

  return documents
    .filter((document): document is LoadedDocument => document !== null)
    .map((document) => toInboxDocument(document, now))
    .filter((document): document is InboxDocument => document !== null)
    .sort((a, b) => compareDocumentPaths(a.path, b.path));
}

export function toInboxDocument(loadedDocument: LoadedDocument, now: Date): InboxDocument | null {
  if (loadedDocument.document.location_class !== "inbox") {
    return null;
  }

  const warnings = [...loadedDocument.frontmatterWarnings];
  const created = loadedDocument.document.frontmatter.created;
  const parsedCreated = created === undefined ? null : parseCreatedDate(created);
  const ageDate = parsedCreated ?? loadedDocument.mtime;

  const inboxDocument: InboxDocument = {
    path: loadedDocument.document.path,
    title: loadedDocument.document.title,
    age_days: calculateAgeDays(ageDate, now),
    age_source: parsedCreated === null ? "filesystem_mtime" : "created",
    frontmatter_warnings: warnings,
  };

  const project = loadedDocument.document.frontmatter.project;
  if (project !== undefined) {
    inboxDocument.project = project;
  }

  return inboxDocument;
}

export function calculateAgeDays(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY_IN_MS));
}

export function parseCreatedDate(value: string): Date | null {
  const parsed = parseCivilDate(value);
  if (parsed === null) {
    return null;
  }

  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

export function resolveTitle(frontmatter: Record<string, string>, body: string, relativePath: string): string {
  const frontmatterTitle = frontmatter.title?.trim();
  if (frontmatterTitle !== undefined && frontmatterTitle !== "") {
    return frontmatterTitle;
  }

  const heading = body
    .split("\n")
    .map((line) => line.endsWith("\r") ? line.slice(0, -1) : line)
    .find((line) => /^#\s+\S/.test(line));

  if (heading !== undefined) {
    return heading.replace(/^#\s+/, "").replace(/\s+#+\s*$/, "").trim();
  }

  return titleFromFilename(relativePath);
}

export function titleFromFilename(relativePath: string): string {
  const basename = path.posix.basename(relativePath, ".md").replace(/^\.+/, "");
  const title = basename.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

  if (title === "") {
    return relativePath;
  }

  return `${title[0]?.toUpperCase() ?? ""}${title.slice(1)}`;
}

async function loadBrainDocument(file: DiscoveredMarkdownFile): Promise<LoadedDocument | null> {
  const locationClass = classifyPath(file.relativePath);
  if (locationClass === null) {
    return null;
  }

  const rawContent = await readFile(file.absolutePath);
  const content = rawContent.toString("utf8");
  const parsed = parseFrontmatter(content);
  const frontmatterWarnings = parsed.warnings.map(formatFrontmatterWarningForInbox);
  const warnings = parsed.warnings.map((warning) => toDocumentWarning(file.relativePath, warning));
  const created = parsed.frontmatter.created;

  if (created !== undefined && parseCreatedDate(created) === null) {
    frontmatterWarnings.push(`invalid created date "${created}"; expected YYYY-MM-DD`);
    warnings.push({
      code: "invalid_created_date",
      message: `${file.relativePath}: invalid created date "${created}"; expected YYYY-MM-DD`,
    });
  }

  warnings.push(...getJournalWarnings(file.relativePath, locationClass));

  return {
    document: {
      path: file.relativePath,
      location_class: locationClass,
      title: resolveTitle(parsed.frontmatter, parsed.body, file.relativePath),
      frontmatter: parsed.frontmatter,
      content_hash: createHash("sha256").update(rawContent).digest("hex"),
      warnings,
    },
    mtime: file.mtime,
    frontmatterWarnings,
  };
}

function getJournalWarnings(relativePath: string, locationClass: LocationClass): DocumentWarning[] {
  if (locationClass !== "journal") {
    return [];
  }

  const basename = path.posix.basename(relativePath, ".md");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(basename)) {
    return [{
      code: "invalid_journal_filename",
      message: `${relativePath}: invalid journal filename; expected journal/YYYY-MM-DD.md`,
    }];
  }

  if (parseCivilDate(basename) === null) {
    return [{
      code: "invalid_journal_date",
      message: `${relativePath}: invalid journal date`,
    }];
  }

  return [];
}

function toDocumentWarning(relativePath: string, warning: FrontmatterWarning): DocumentWarning {
  const line = warning.line === undefined ? "" : `: line ${warning.line}`;
  return {
    code: warning.code,
    message: `${relativePath}${line}: ${warning.message}`,
  };
}

function formatFrontmatterWarningForInbox(warning: FrontmatterWarning): string {
  if (warning.line === undefined) {
    return warning.message;
  }

  return `line ${warning.line}: ${warning.message}`;
}
