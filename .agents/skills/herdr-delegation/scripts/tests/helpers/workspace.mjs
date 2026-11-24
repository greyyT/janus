import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HELPERS_DIR = dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = join(HELPERS_DIR, "..");
const SCRIPTS_DIR = join(TESTS_DIR, "..");
const FIXTURE_BIN = join(TESTS_DIR, "fixtures", "bin");

export const SPAWN_AGENT_PATH = join(SCRIPTS_DIR, "spawn-agent");

/**
 * Sets up an isolated workspace with a fake `herdr` on PATH that plays back
 * an ordered JSON response script (one entry per invocation) and journals
 * every invocation's argv for assertions.
 */
export function createTestEnv({ responses = [] } = {}) {
 const workspace = mkdtempSync(join(tmpdir(), "herdr-spawn-agent-v2-"));
 const journalPath = join(workspace, "journal.ndjson");
 const scriptPath = join(workspace, "script.json");
 const promptPath = join(workspace, "task-prompt.md");
 writeFileSync(journalPath, "", "utf8");
 writeFileSync(scriptPath, JSON.stringify(responses), "utf8");
 writeFileSync(promptPath, "Perform this bounded task. Write the result to /tmp/test-result.md.\n", "utf8");

 const binDir = join(workspace, "bin");
 mkdirSync(binDir, { recursive: true });
 const wrapperPath = join(binDir, "herdr");
 const realHerdr = join(FIXTURE_BIN, "herdr");
 writeFileSync(
  wrapperPath,
  [
   "#!/usr/bin/env node",
   `process.env.HERDR_FAKE_JOURNAL = ${JSON.stringify(journalPath)};`,
   `process.env.HERDR_FAKE_SCRIPT = ${JSON.stringify(scriptPath)};`,
   `await import(${JSON.stringify(`file://${realHerdr}`)});`,
   "",
  ].join("\n"),
  "utf8",
 );
 chmodSync(wrapperPath, 0o755);

 function run(args, { env = {} } = {}) {
  return spawnSync(SPAWN_AGENT_PATH, args, {
   encoding: "utf8",
   shell: false,
   env: {
    ...process.env,
    PATH: `${binDir}:${process.env.PATH}`,
    HERDR_ENV: "1",
    ...env,
   },
  });
 }

 function journal() {
  const raw = readFileSync(journalPath, "utf8");
  return raw
   .split("\n")
   .filter((line) => line.trim() !== "")
   .map((line) => JSON.parse(line));
 }

 function cleanup() {
  rmSync(workspace, { recursive: true, force: true });
 }

 return { workspace, promptPath, run, journal, cleanup, binDir };
}
