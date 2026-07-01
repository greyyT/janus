import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const TSX = path.resolve("node_modules/.bin/tsx");
const ADD = path.resolve("tools/brain/task-add.ts");
const LIST = path.resolve("tools/brain/task-list.ts");
const MOVE = path.resolve("tools/brain/task-move.ts");

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "janus-task-cli-"));
  await writeFile(path.join(root, "package.json"), "{}", "utf8");
  await writeFile(path.join(root, "AGENTS.md"), "# Agents", "utf8");
  await mkdir(path.join(root, "templates"), { recursive: true });
  await mkdir(path.join(root, "journal"), { recursive: true });
  await writeFile(path.join(root, "templates", "journal.md"), "# {{date:YYYY-MM-DD}}\n\n## Check-in\n\n## Todo\n\n- [ ]\n\n## Notes\n\n## Checkout\n\n- task_decisions:\n", "utf8");
  await writeFile(path.join(root, "backlog.md"), "# Backlog\n\n<!-- janus-backlog: next_task_id=2 -->\n\n- [ ] [J-001] Existing\n", "utf8");
  await writeFile(path.join(root, "journal", "2026-06-30.md"), "# 2026-06-30\n\n## Check-in\n\n## Todo\n\n- [ ]\n\n## Notes\n\n## Checkout\n", "utf8");
  return root;
}

describe("task CLIs", () => {
  test("task:list reports active backlog and journal tasks as JSON", async () => {
    const root = await createFixture();
    await writeFile(path.join(root, "journal", "2026-06-29.md"), "# 2026-06-29\n\n## Todo\n\n- [ ] [J-009] Journal task\n", "utf8");

    const result = await run(root, LIST, ["--json"]);
    const output = JSON.parse(result.stdout);
    expect(output.tasks.map((task: { id: string }) => task.id)).toEqual(["J-001", "J-009"]);
  });

  test("task:add dry-run previews next ID without mutating backlog", async () => {
    const root = await createFixture();
    const before = await readFile(path.join(root, "backlog.md"), "utf8");

    const result = await run(root, ADD, ["--title", "New task", "--dry-run", "--json"]);

    expect(JSON.parse(result.stdout)).toMatchObject({ action: "preview_add_task", task: { id: "J-002", title: "New task" } });
    expect(await readFile(path.join(root, "backlog.md"), "utf8")).toBe(before);
  });

  test("task:move dry-run previews source and destination without mutating", async () => {
    const root = await createFixture();
    const before = await readFile(path.join(root, "backlog.md"), "utf8");

    const result = await run(root, MOVE, ["--from", "backlog", "--to", "today", "--date", "2026-06-30", "J-001", "--dry-run", "--json"]);

    expect(JSON.parse(result.stdout)).toEqual({
      action: "preview_move_tasks",
      changed_paths: ["backlog.md", "journal/2026-06-30.md"],
      task_ids: ["J-001"],
    });
    expect(await readFile(path.join(root, "backlog.md"), "utf8")).toBe(before);
  });
});

async function run(cwd: string, script: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(TSX, [script, ...args], { cwd });
  return { stdout: result.stdout.trimEnd(), stderr: result.stderr.trimEnd() };
}
