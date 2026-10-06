import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { formatCivilDate, parseCivilDate, todayLocalCivilDate } from "./civil-date.js";
import { isNotFoundError } from "./filesystem.js";

export interface JanusSession {
  path: string;
  name: string | null;
  firstActivity: string;
  lastActivity: string;
}

export interface SessionEntry {
  type?: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  cwd?: string;
  name?: string;
  customType?: string;
  message?: { role?: string; content?: unknown };
}

// `/coordinate` appends this entry; the mode has no off, so the rest of the
// transcript is coordination, not conversation Dream learns from.
export const COORDINATE_MARKER = "janus-coordinate";

export function resolveSessionsDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.PI_CODING_AGENT_SESSION_DIR) return expandHome(env.PI_CODING_AGENT_SESSION_DIR);
  const agentDir = env.PI_CODING_AGENT_DIR ? expandHome(env.PI_CODING_AGENT_DIR) : path.join(os.homedir(), ".pi", "agent");
  return path.join(agentDir, "sessions");
}

// A Janus session is a pi transcript whose working directory is the Janus root.
// Coordinators run in `coordinator/`, so their transcripts never match.
// Only entries before the coordinate marker count.
export async function listJanusSessions(repositoryRoot: string, date: string, sessionsDir: string): Promise<JanusSession[]> {
  const civilDate = parseCivilDate(date);
  if (civilDate === null) throw new Error(`invalid date "${date}"`);
  const dayStart = new Date(civilDate.year, civilDate.month - 1, civilDate.day);
  const root = path.resolve(repositoryRoot);

  const sessions: JanusSession[] = [];
  for (const transcript of await listTranscripts(sessionsDir)) {
    if ((await stat(transcript)).mtime < dayStart) continue;
    const session = await readSessionOnDate(transcript, root, date);
    if (session !== null) sessions.push(session);
  }
  return sessions.sort((a, b) => a.firstActivity.localeCompare(b.firstActivity));
}

async function listTranscripts(sessionsDir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(sessionsDir, { withFileTypes: true });
  } catch (error) {
    if (isNotFoundError(error)) return [];
    throw error;
  }

  const transcripts: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(sessionsDir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".jsonl")) transcripts.push(entryPath);
    if (!entry.isDirectory()) continue;
    for (const name of await readdir(entryPath)) {
      if (name.endsWith(".jsonl")) transcripts.push(path.join(entryPath, name));
    }
  }
  return transcripts;
}

export async function readJanusTranscript(transcript: string): Promise<SessionEntry[]> {
  const entries = (await readFile(transcript, "utf8")).split("\n").flatMap(parseEntry);
  const marker = entries.findIndex(entry => entry.type === "custom" && entry.customType === COORDINATE_MARKER);
  return marker === -1 ? entries : entries.slice(0, marker);
}

async function readSessionOnDate(transcript: string, root: string, date: string): Promise<JanusSession | null> {
  const entries = await readJanusTranscript(transcript);
  const header = entries.find(entry => entry.type === "session");
  if (header?.cwd === undefined || path.resolve(header.cwd) !== root) return null;

  let name: string | null = null;
  let firstActivity: string | undefined;
  let lastActivity: string | undefined;
  for (const entry of entries) {
    if (entry.type === "session_info" && entry.name) name = entry.name;
    if (entry.timestamp === undefined || localDateKey(entry.timestamp) !== date) continue;
    firstActivity ??= entry.timestamp;
    lastActivity = entry.timestamp;
  }
  if (firstActivity === undefined || lastActivity === undefined) return null;
  return { path: transcript, name, firstActivity, lastActivity };
}

// pi may be mid-write on the last line of a live session.
function parseEntry(line: string): SessionEntry[] {
  if (line.trim() === "") return [];
  try {
    return [JSON.parse(line) as SessionEntry];
  } catch {
    return [];
  }
}

function localDateKey(timestamp: string): string {
  return formatCivilDate(todayLocalCivilDate(new Date(timestamp)));
}

function expandHome(value: string): string {
  return value === "~" || value.startsWith("~/") ? path.join(os.homedir(), value.slice(1)) : value;
}
