import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = realpathSync(mkdtempSync(join(tmpdir(), "janus-handoff-test-")));
const script = fileURLToPath(new URL("../handoff", import.meta.url));
const packet = join(directory, "resume packet.md");
writeFileSync(packet, "# Handoff\nPrivate resume content\n", { mode: 0o600 });
writeFileSync(join(directory, "herdr"), `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALL_LOG, JSON.stringify(args) + "\\n");
const stage = args[1];
if (stage === process.env.FAIL_STAGE) { console.error("injected " + stage + " failure"); process.exit(1); }
if (stage === "start") {
  const splitTime = Number(fs.readFileSync(process.env.CALL_LOG + ".split-time", "utf8"));
  if (Date.now() - splitTime < 2000) { console.error("pane is still initializing"); process.exit(1); }
}
if (stage === "split") {
  fs.writeFileSync(process.env.CALL_LOG + ".split-time", String(Date.now()));
  if (process.env.SPLIT_RESPONSE) console.log(process.env.SPLIT_RESPONSE);
  else console.log(JSON.stringify({result: {pane: {pane_id: "test:destination"}}}));
}
`, { mode: 0o700 });

let caseNumber = 0;
function launch(overrides = {}, packetPath = packet, sessionName = "Review ticket handoff") {
  const log = join(directory, `calls-${caseNumber++}.jsonl`);
  writeFileSync(log, "");
  const args = [script, packetPath];
  if (sessionName !== null) args.push(sessionName);
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    cwd: directory,
    env: {
      ...process.env, PATH: directory + delimiter + process.env.PATH,
      HERDR_ENV: "1", HERDR_PANE_ID: "test:source", CALL_LOG: log, FAIL_STAGE: "", SPLIT_RESPONSE: "", ...overrides
    },
  });
  const calls = readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  return { ...result, calls };
}

const success = launch();
assert.equal(success.status, 0, success.stderr);
assert.deepEqual(success.calls.map(args => args[1]), ["split", "start", "prompt", "focus", "close"]);
assert.deepEqual(success.calls[0], ["pane", "split", "--pane", "test:source", "--direction", "right", "--cwd", directory, "--no-focus"]);
const record = JSON.parse(success.stdout);
assert.match(record.destinationName, /^[a-z][a-z0-9_-]{0,31}$/);
assert.equal(record.sessionName, "Review ticket handoff");
assert.deepEqual(success.calls[1], ["agent", "start", record.destinationName, "--kind", "pi", "--pane", "test:destination", "--", "--name", "Review ticket handoff"]);
assert.equal(success.calls[2].length, 4);
assert.ok(success.calls[2][3].includes(record.packetPath));
assert.notEqual(record.packetPath, packet);
assert.equal(readFileSync(record.packetPath, "utf8"), readFileSync(packet, "utf8"));
assert.equal(statSync(dirname(record.packetPath)).mode & 0o777, 0o700);
assert.equal(statSync(record.packetPath).mode & 0o777, 0o600);
assert.ok(!success.calls[2][3].includes("Private resume content"));
assert.ok(success.calls[2][3].includes("verify any recorded workflow authorization against its canonical records"));
assert.ok(!success.calls[2][3].includes("unless the user explicitly asks"));
assert.deepEqual(success.calls[3], ["agent", "focus", record.destinationName]);
assert.deepEqual(success.calls[4], ["pane", "close", "test:source"]);

for (const stage of ["split", "start", "prompt", "focus", "close"]) {
  const failure = launch({ FAIL_STAGE: stage });
  assert.equal(failure.status, 1);
  assert.equal(JSON.parse(failure.stderr.split("\n").filter(Boolean).at(-1)).stage, stage);
  assert.equal(failure.calls.at(-1)[1], stage);
  if (stage !== "close") assert.ok(!failure.calls.some(args => args[1] === "close"));
}
for (const overrides of [{ HERDR_ENV: "0" }, { HERDR_PANE_ID: "" }]) {
  const failure = launch(overrides);
  assert.equal(failure.status, 1);
  assert.equal(failure.calls.length, 0);
}
for (const response of ["not json", "{}", '{"result":{"pane":{"pane_id":"test:source"}}}']) {
  const failure = launch({ SPLIT_RESPONSE: response });
  assert.equal(failure.status, 1);
  assert.equal(failure.calls.length, 1);
}
const emptyPacket = join(directory, "empty.md");
writeFileSync(emptyPacket, "");
for (const path of [emptyPacket, join(directory, "missing.md")]) {
  const failure = launch({}, path);
  assert.equal(failure.status, 1);
  assert.equal(failure.calls.length, 0);
}
for (const name of [null, "", "   "]) {
  const failure = launch({}, packet, name);
  assert.equal(failure.status, 1);
  assert.equal(failure.calls.length, 0);
}
console.log("PASS: session display name, right-pane transfer, path-only prompt, private packet, source-only final close, and 15 failure cases");
