import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  addCivilDays,
  classifyPath,
  discoverRootMarkdownFiles,
  formatCivilDate,
  isNotFoundError,
  listJanusSessions,
  parseCivilDate,
  readJanusTranscript,
  renderTranscript,
  todayLocalCivilDate,
} from "../../brain/lib/index.js";

// How far back Dream looks for an earlier sighting of an observation.
export const SIGHTING_DAYS = 30;

export interface DreamPullRequest {
  headRefName: string;
  url: string;
  createdAt: string;
  state: string;
  body: string;
}

export interface DreamInputSources {
  root: string;
  days: string[];
  notesDir: string;
  sessionsDir: string;
  // `git show --stat --patch` of the commit holding the uncommitted changes, or null.
  changes: string | null;
  // Dream PRs from `gh pr list`, or the reason they are unavailable.
  pullRequests: DreamPullRequest[] | string;
}

export async function buildDreamInput(sources: DreamInputSources): Promise<string> {
  const kept = await keptUnchangedNotes(sources.root);
  const sections = [
    `# Dream input\n\nDays: ${sources.days.join(", ")}`,
    renderChanges(sources.changes),
    await renderRootNotes(sources.notesDir, kept),
    await renderConversations(sources),
    renderSightings(sources.pullRequests, sources.days[0]),
  ];
  return `${sections.join("\n\n")}\n`;
}

export function noticedSection(body: string): string {
  const section = `\n${body}`.split("\n## ").find(part => part.startsWith("Noticed, not changed"));
  return section === undefined ? "" : section.slice("Noticed, not changed".length).trim();
}

// `.janus/dream/kept` lists notes Dream kept unresolved as "<sha1>\t<name>".
// Unchanged ones stay in the main checkout and are not part of the run.
async function keptUnchangedNotes(root: string): Promise<string[]> {
  let lines: string[];
  try {
    lines = (await readFile(path.join(root, ".janus", "dream", "kept"), "utf8")).split("\n");
  } catch (error) {
    if (isNotFoundError(error)) return [];
    throw error;
  }
  const unchanged: string[] = [];
  for (const line of lines) {
    const [sha, name] = line.split("\t");
    if (!name) continue;
    try {
      if (sha1(await readFile(path.join(root, name))) === sha) unchanged.push(name);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  }
  return unchanged;
}

function sha1(content: Buffer): string {
  return createHash("sha1").update(content).digest("hex");
}

function renderChanges(changes: string | null): string {
  if (changes === null) return "## Uncommitted changes\n\nNone.";
  return `## Uncommitted changes\n\n~~~~diff\n${changes.trimEnd()}\n~~~~`;
}

async function renderRootNotes(notesDir: string, kept: string[]): Promise<string> {
  const notes = (await discoverRootMarkdownFiles(notesDir))
    .filter(file => classifyPath(file.relativePath) === "inbox" && !kept.includes(file.relativePath))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const parts = ["## Root notes"];
  if (notes.length === 0) parts.push("None.");
  for (const note of notes) {
    parts.push(`### ${note.relativePath}\n\n~~~~md\n${(await readFile(note.absolutePath, "utf8")).trimEnd()}\n~~~~`);
  }
  if (kept.length > 0) parts.push(`Kept earlier and unchanged, in the main checkout and not part of this run: ${kept.join(", ")}`);
  return parts.join("\n\n");
}

async function renderConversations({ root, days, sessionsDir }: DreamInputSources): Promise<string> {
  const parts = ["## Conversations"];
  const rendered = new Set<string>();
  for (const day of days) {
    for (const session of await listJanusSessions(root, day, sessionsDir)) {
      if (rendered.has(session.path)) continue;
      rendered.add(session.path);
      const transcript = renderTranscript(await readJanusTranscript(session.path));
      parts.push(`### ${day} · ${session.name ?? "(unnamed)"}\n\nTranscript: ${session.path}\n\n${transcript}`);
    }
  }
  if (rendered.size === 0) parts.push("None.");
  return parts.join("\n\n");
}

function renderSightings(pullRequests: DreamPullRequest[] | string, firstDay: string): string {
  const firstDate = parseCivilDate(firstDay);
  if (firstDate === null) throw new Error(`invalid day "${firstDay}"`);
  const since = formatCivilDate(addCivilDays(firstDate, -SIGHTING_DAYS));
  const heading = `## Earlier sightings\n\n\`## Noticed, not changed\` from dream PRs created since ${since}.`;
  if (typeof pullRequests === "string") return `${heading}\n\nUnavailable: ${pullRequests}`;

  const parts = [heading];
  for (const pr of pullRequests) {
    if (!pr.headRefName.startsWith("dream/")) continue;
    if (formatCivilDate(todayLocalCivilDate(new Date(pr.createdAt))) < since) continue;
    const noticed = noticedSection(pr.body);
    if (noticed) parts.push(`### ${pr.url} · ${pr.createdAt.slice(0, 10)} · ${pr.state.toLowerCase()}\n\n${noticed}`);
  }
  if (parts.length === 1) parts.push("None.");
  return parts.join("\n\n");
}
