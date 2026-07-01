import { describe, expect, test } from "vitest";
import { addTaskToBacklog, appendTaskBlocksToSection, parseBacklog, parseTaskBlocks, removeTaskBlocks } from "./backlog.js";

const EMPTY_BACKLOG = "# Backlog\n\n<!-- janus-backlog: next_task_id=3 -->\n";

describe("parseBacklog", () => {
  test("parses valid tasks in deterministic order and preserves indented Markdown", () => {
    const parsed = parseBacklog(`${EMPTY_BACKLOG}\n- [ ] [J-001] First task\n  - estimate: quick\n  - context:\n    - keep this markdown\n    - [ ] nested checkbox is body\n\n- [x] [J-002] Done task\n`);

    expect(parsed.tasks.map((task) => task.id)).toEqual(["J-001", "J-002"]);
    expect(parsed.tasks[0].lines).toContain("    - [ ] nested checkbox is body");
    expect(parsed.tasks[1]).toMatchObject({ checked: true, title: "Done task" });
  });

  test("rejects duplicate active task IDs", () => {
    expect(() => parseBacklog(`${EMPTY_BACKLOG}\n- [ ] [J-001] One\n- [ ] [J-001] Two\n`)).toThrow("duplicate active task ID J-001");
  });

  test("rejects task lines with multiple task IDs", () => {
    expect(() => parseBacklog(`${EMPTY_BACKLOG}\n- [ ] [J-001] Merge [J-002]\n`)).toThrow("exactly one task ID");
  });

  test("rejects malformed task IDs", () => {
    expect(() => parseBacklog(`${EMPTY_BACKLOG}\n- [ ] [J-1] Bad\n`)).toThrow("malformed task ID");
  });

  test("rejects missing and invalid counters", () => {
    expect(() => parseBacklog("# Backlog\n\n- [ ] [J-001] Missing\n")).toThrow("missing valid");
    expect(() => parseBacklog("# Backlog\n\n<!-- janus-backlog: next_task_id=0 -->\n")).toThrow("missing valid");
  });

  test("rejects counter lower than max existing task ID plus one", () => {
    expect(() => parseBacklog("# Backlog\n\n<!-- janus-backlog: next_task_id=2 -->\n\n- [ ] [J-002] Existing\n")).toThrow("must be greater");
  });
});

describe("backlog edits", () => {
  test("adds a task and increments the counter", () => {
    const result = addTaskToBacklog(EMPTY_BACKLOG, {
      title: "Write parser",
      added: "2026-06-30",
      estimate: "medium",
      context: ["Keep unknown Markdown below the block."],
    });

    expect(result.task.id).toBe("J-003");
    expect(result.content).toContain("<!-- janus-backlog: next_task_id=4 -->");
    expect(result.content).toContain("  - estimate: medium");
    expect(result.content).toContain("    - Keep unknown Markdown below the block.");
  });

  test("removes exact task blocks and keeps nested checkboxes with the moved task", () => {
    const content = `${EMPTY_BACKLOG}\n- [ ] [J-001] Move me\n  - context:\n    - [ ] nested body\n\n- [ ] [J-002] Stay\n`;
    const removed = removeTaskBlocks(content, ["J-001"], "backlog.md");

    expect(removed.content).not.toContain("J-001");
    expect(removed.content).toContain("J-002");
    expect(removed.tasks[0].lines).toContain("    - [ ] nested body");
  });

  test("appends task blocks to a journal Todo section", () => {
    const journal = "# 2026-06-30\n\n## Todo\n\n- [ ]\n\n## Notes\n";
    const updated = appendTaskBlocksToSection(journal, "## Todo", [["- [ ] [J-001] Task"]]);
    expect(parseTaskBlocks(updated, "journal/2026-06-30.md").tasks.map((task) => task.id)).toContain("J-001");
  });
});
