import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { listJanusSessions, resolveSessionsDir } from "./sessions.js";

const DATE = "2026-01-15";

function localIso(day: number, hour: number, minute = 0): string {
  return new Date(2026, 0, day, hour, minute).toISOString();
}

async function writeTranscript(dir: string, name: string, cwd: string, timestamps: string[], sessionName?: string): Promise<string> {
  const [start, ...rest] = timestamps;
  const lines = [
    { type: "session", id: name, timestamp: start, cwd },
    ...(sessionName ? [{ type: "session_info", timestamp: start, name: sessionName }] : []),
    ...rest.map(timestamp => ({ type: "message", timestamp })),
  ];
  const transcript = path.join(dir, `${name}.jsonl`);
  await writeFile(transcript, `${lines.map(line => JSON.stringify(line)).join("\n")}\n`, "utf8");
  return transcript;
}

async function createFixture(): Promise<{ root: string; sessionsDir: string; projectDir: string }> {
  const base = await mkdtemp(path.join(os.tmpdir(), "janus-sessions-"));
  const root = path.join(base, "janus");
  const sessionsDir = path.join(base, "sessions");
  const projectDir = path.join(sessionsDir, "--janus--");
  await mkdir(projectDir, { recursive: true });
  return { root, sessionsDir, projectDir };
}

describe("listJanusSessions", () => {
  test("lists Janus sessions active on the local day and skips coordinator and other sessions", async () => {
    const { root, sessionsDir, projectDir } = await createFixture();
    const morning = await writeTranscript(projectDir, "morning", root, [localIso(15, 9), localIso(15, 10, 30)], "Morning planning");
    await writeTranscript(projectDir, "coordinator", path.join(root, "coordinator"), [localIso(15, 11)]);
    await writeTranscript(projectDir, "elsewhere", "/somewhere/else", [localIso(15, 12)]);
    await writeTranscript(projectDir, "yesterday", root, [localIso(14, 20)]);

    await expect(listJanusSessions(root, DATE, sessionsDir)).resolves.toEqual([
      { path: morning, name: "Morning planning", firstActivity: localIso(15, 9), lastActivity: localIso(15, 10, 30) },
    ]);
  });

  test("counts only the entries that fall on the local day", async () => {
    const { root, sessionsDir, projectDir } = await createFixture();
    const pastMidnight = await writeTranscript(projectDir, "past-midnight", root, [localIso(14, 23, 30), localIso(15, 0, 20), localIso(15, 1)]);

    await expect(listJanusSessions(root, DATE, sessionsDir)).resolves.toEqual([
      { path: pastMidnight, name: null, firstActivity: localIso(15, 0, 20), lastActivity: localIso(15, 1) },
    ]);
  });

  test("returns nothing when the sessions directory does not exist", async () => {
    const { root, sessionsDir } = await createFixture();
    await expect(listJanusSessions(root, DATE, path.join(sessionsDir, "missing"))).resolves.toEqual([]);
  });
});

describe("resolveSessionsDir", () => {
  test("prefers the session directory override, then the agent directory, then the default", () => {
    expect(resolveSessionsDir({ PI_CODING_AGENT_SESSION_DIR: "/s", PI_CODING_AGENT_DIR: "/a" })).toBe("/s");
    expect(resolveSessionsDir({ PI_CODING_AGENT_DIR: "/a" })).toBe(path.join("/a", "sessions"));
    expect(resolveSessionsDir({})).toBe(path.join(os.homedir(), ".pi", "agent", "sessions"));
  });
});
