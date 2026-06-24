import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { classifyPath, compareDocumentPaths, type LocationClass } from "./classify.js";
import { discoverMarkdownFiles, type DiscoveredMarkdownFile } from "./filesystem.js";
import { parseFrontmatter } from "./frontmatter.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface BrainDocument {
  path: string;
  location_class: LocationClass;
  title: string;
  frontmatter: Record<string, string>;
  content_hash: string;
  frontmatter_warnings: string[];
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
}

export async function loadBrainDocuments(repositoryRoot: string): Promise<LoadedDocument[]> {
  const files = await discoverMarkdownFiles(repositoryRoot);
  const documents = await Promise.all(files.map(loadBrainDocument));

  return documents
    .filter((document): document is LoadedDocument => document !== null)
    .sort((a, b) => compareDocumentPaths(a.document.path, b.document.path));
}

export function toInboxDocument(loadedDocument: LoadedDocument, now: Date): InboxDocument | null {
  if (loadedDocument.document.location_class !== "inbox") {
    return null;
  }

  const warnings = [...loadedDocument.document.frontmatter_warnings];
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
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
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

  const warnings = [...parsed.warnings];
  const created = parsed.frontmatter.created;
  if (created !== undefined && parseCreatedDate(created) === null) {
    warnings.push(`invalid created date "${created}"; expected YYYY-MM-DD`);
  }

  return {
    document: {
      path: file.relativePath,
      location_class: locationClass,
      title: resolveTitle(parsed.frontmatter, parsed.body, file.relativePath),
      frontmatter: parsed.frontmatter,
      content_hash: createHash("sha256").update(rawContent).digest("hex"),
      frontmatter_warnings: warnings,
    },
    mtime: file.mtime,
  };
}
