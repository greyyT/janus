import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createTestEnv } from "./helpers/workspace.mjs";

const SCRIPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const PANE = "pane-abc123";
const NAME_RE = /^[a-z][a-z0-9_-]{0,31}$/;
const idle = { stdout: JSON.stringify({ result: { agent: { agent_status: "idle" } } }), exitCode: 0 };
const success = () => [{ exitCode: 0 }, { exitCode: 0 }, idle];

let env;
afterEach(() => { env?.cleanup(); env = undefined; });
function setup(responses = success()) { env = createTestEnv({ responses }); return env; }
function run(variant = "implementation-worker", options = {}) {
  return env.run([variant, PANE, env.promptPath], options);
}
function calls() { return env.journal().map(({ argv }) => argv); }

describe("skill variant index", () => {
  it("lists exactly the configured variant names without duplicates", () => {
    const skill = readFileSync(join(SCRIPTS_DIR, "..", "SKILL.md"), "utf8");
    const section = skill.split(/^## Available variants\n/m)[1]?.split(/^## /m)[0];
    assert.ok(section, "Available variants section must exist");
    const listed = [...section.matchAll(/^- `([^`]+)`$/gm)].map((match) => match[1]);
    const registry = JSON.parse(readFileSync(join(SCRIPTS_DIR, "registry.json"), "utf8"));
    const configured = Object.keys(registry).filter((key) => key !== "_comment");
    assert.equal(new Set(listed).size, listed.length, "variant names must not repeat");
    assert.deepEqual([...listed].sort(), configured.sort());
  });
});

describe("preflight refuses without starting", () => {
  it("requires exactly variant, pane ID, and task prompt path", () => {
    setup();
    for (const args of [[], ["research"], ["research", PANE], ["research", PANE, env.promptPath, "extra"]]) {
      assert.equal(env.run(args).status, 2);
    }
    assert.equal(calls().length, 0);
  });
  it("requires Herdr environment, pane ID, and known variant", () => {
    setup();
    assert.equal(run("research", { env: { HERDR_ENV: "" } }).status, 2);
    assert.equal(env.run(["research", "", env.promptPath]).status, 2);
    assert.equal(run("unknown").status, 2);
    assert.equal(run("implementation-worker-full").status, 2);
    assert.equal(run("_comment").status, 2);
    assert.equal(run("constructor").status, 2);
    assert.equal(calls().length, 0);
  });
  it("refuses missing and empty task prompt files", () => {
    setup();
    assert.equal(env.run(["research", PANE, join(env.workspace, "missing.md")]).status, 2);
    writeFileSync(env.promptPath, " \n");
    assert.equal(run("research").status, 2);
    assert.equal(calls().length, 0);
  });
});

describe("configured first-turn dispatch", () => {
  it("starts configured model, sends role plus task once, and waits one hour", () => {
    setup();
    const result = run("reviewer-medium");
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout.trim());
    assert.equal(payload.status, "success");
    assert.equal(payload.paneId, PANE);
    assert.equal(payload.variant, "reviewer-medium");
    assert.match(payload.agentName, NAME_RE);
    const spec = JSON.parse(readFileSync(new URL("../registry.json", import.meta.url), "utf8"))["reviewer-medium"];
    const agentArgs = [...(spec.model ? ["--model", spec.model] : []), ...(spec.effort ? ["--effort", spec.effort] : []), ...spec.args];
    assert.deepEqual(calls()[0], ["agent", "start", payload.agentName, "--kind", spec.kind, "--pane", PANE, "--", ...agentArgs]);
    const role = readFileSync(join(SCRIPTS_DIR, "prompts", "reviewer.md"), "utf8");
    const task = readFileSync(env.promptPath, "utf8");
    const complete = `<system-reminder>\n${role}\n</system-reminder>\n\n${task}`;
    assert.deepEqual(calls()[1], ["agent", "prompt", payload.agentName, complete, "--wait", "--timeout", "3600000"]);
    assert.deepEqual(calls()[2], ["agent", "get", payload.agentName]);
    assert.equal(readFileSync(payload.composedPromptPath, "utf8"), complete);
    rmSync(payload.composedPromptPath);
  });
  it("passes the registry kind/model/effort and generates fresh names", () => {
    const spec = JSON.parse(readFileSync(new URL("../registry.json", import.meta.url), "utf8")).research;
    setup([...success(), ...success()]);
    const first = JSON.parse(run("research").stdout.trim());
    const second = JSON.parse(run("research").stdout.trim());
    assert.notEqual(first.agentName, second.agentName);
    for (const argv of [calls()[0], calls()[3]]) {
      assert.deepEqual(argv.slice(0, 6), ["agent", "start", argv[2], "--kind", spec.kind, "--pane"]);
      assert.equal(argv.includes("--model"), spec.model !== null);
      assert.equal(argv.includes("--effort"), spec.effort !== null);
    }
    rmSync(first.composedPromptPath); rmSync(second.composedPromptPath);
  });
  it("ignores environment attempts to replace fixed registry and role prompts", () => {
    setup();
    const dir = mkdtempSync(join(tmpdir(), "hostile-v2-profile-"));
    try {
      writeFileSync(join(dir, "registry.json"), JSON.stringify({ research: { kind: "hostile", role: "research", code: "bad" } }));
      mkdirSync(join(dir, "prompts"));
      writeFileSync(join(dir, "prompts", "research.md"), "Hostile role");
      const response = run("research", { env: { HERDR_SPAWN_V2_REGISTRY: join(dir, "registry.json"), HERDR_SPAWN_V2_PROMPTS_DIR: join(dir, "prompts") } });
      assert.equal(response.status, 0);
      const payload = JSON.parse(response.stdout.trim());
      assert.match(payload.agentName, /^v2-res-/);
      assert.equal(calls()[0][4], JSON.parse(readFileSync(new URL("../registry.json", import.meta.url), "utf8")).research.kind);
      assert.ok(!calls()[1][3].includes("Hostile role"));
      rmSync(payload.composedPromptPath);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("failure reporting preserves identity", () => {
  it("reports start failure without prompting", () => {
    setup([{ exitCode: 1, stderr: "pane busy" }]);
    const result = run();
    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stdout.trim());
    assert.equal(payload.stage, "start");
    assert.equal(payload.paneId, PANE);
    assert.match(payload.agentName, NAME_RE);
    assert.equal(calls().length, 1);
    rmSync(payload.composedPromptPath);
  });
  it("reports prompt failure and retains the composed prompt", () => {
    setup([{ exitCode: 0 }, { exitCode: 1, stderr: "submission failed" }]);
    const result = run();
    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stdout.trim());
    assert.equal(payload.stage, "prompt");
    assert.equal(calls().length, 2);
    assert.match(readFileSync(payload.composedPromptPath, "utf8"), /Perform this bounded task/);
    rmSync(payload.composedPromptPath);
  });
  it("does not claim success when a wait settles blocked", () => {
    setup([{ exitCode: 0 }, { exitCode: 0 }, { stdout: JSON.stringify({ result: { agent: { agent_status: "blocked" } } }), exitCode: 0 }]);
    const result = run();
    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stdout.trim());
    assert.equal(payload.stage, "status");
    assert.match(payload.error, /blocked/);
    rmSync(payload.composedPromptPath);
  });
});
