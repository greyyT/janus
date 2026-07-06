import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const NODE = process.execPath;
const TSX_IMPORT = path.resolve("node_modules/tsx/dist/loader.mjs");
const ADD = path.resolve("tools/brain/task-add.ts");
const LIST = path.resolve("tools/brain/task-list.ts");
const MOVE = path.resolve("tools/brain/task-move.ts");
const PENDING = path.resolve("tools/brain/task-pending.ts");

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "janus-task-cli-"));
  await writeFile(path.join(root, "package.json"), "{}", "utf8");
  await writeFile(path.join(root, "AGENTS.md"), "# Agents", "utf8");
  await mkdir(path.join(root, "templates"), { recursive: true });
  await mkdir(path.join(root, "journal"), { recursive: true });
  await mkdir(path.join(root, "brain", "projects", "janus"), { recursive: true });
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

  test("task:pending creates task-create.md and task:add --form consumes it", async () => {
    const root = await createFixture();

    const pendingResult = await run(root, PENDING, ["--json"]);
    expect(JSON.parse(pendingResult.stdout)).toMatchObject({
      action: "created_task_pending",
      path: "task-create.md",
      project_slugs: ["janus"],
    });

    await writeFile(path.join(root, "task-create.md"), `---
title: Improve add task flow
project: Janus
estimate: medium
deadline:
blocked_by:
---

## Context

- Faster than chat

## References

- journal/2026-07-01.md
`, "utf8");

    const addResult = await run(root, ADD, ["--form", "task-create.md", "--json"]);
    expect(JSON.parse(addResult.stdout)).toMatchObject({
      action: "added_task",
      task: { id: "J-002", title: "Improve add task flow" },
      changed_paths: ["backlog.md", "task-create.md"],
    });
    expect(await readFile(path.join(root, "backlog.md"), "utf8")).toContain("  - added: ");
    expect(await readFile(path.join(root, "backlog.md"), "utf8")).toContain("  - project: janus");
    await expect(readFile(path.join(root, "task-create.md"), "utf8")).rejects.toThrow();
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
  const result = await execFileAsync(NODE, ["--import", TSX_IMPORT, script, ...args], { cwd });
  return { stdout: result.stdout.trimEnd(), stderr: result.stderr.trimEnd() };
}
