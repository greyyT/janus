import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { applyCheckinPlan, applyCheckoutPlan, ensureJournal } from "./daily-workflow.js";

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "janus-daily-"));
  await writeFile(path.join(root, "package.json"), "{}", "utf8");
  await writeFile(path.join(root, "AGENTS.md"), "# Agents", "utf8");
  await mkdir(path.join(root, "templates"), { recursive: true });
  await mkdir(path.join(root, "journal"), { recursive: true });
  await writeFile(path.join(root, "templates", "journal.md"), "# {{date:YYYY-MM-DD}}\n\n## Check-in\n\n- capacity:\n- primary_outcome:\n- calendar_summary:\n- constraints:\n\n## Todo\n\n- [ ]\n\n## Notes\n\n## Checkout\n\n- wellbeing:\n- worked:\n- improve:\n- handoff:\n- next_step:\n- task_decisions:\n- digest:\n", "utf8");
  await writeFile(path.join(root, "backlog.md"), "# Backlog\n\n<!-- janus-backlog: next_task_id=3 -->\n\n- [ ] [J-001] Backlog task\n  - estimate: quick\n\n- [ ] [J-002] Other task\n", "utf8");
  return root;
}

describe("ensureJournal", () => {
  test("creates a journal from the template when missing", async () => {
    const root = await createFixture();
    const journal = await ensureJournal(root, "2026-06-30");

    expect(journal.created).toBe(true);
    expect(journal.path).toBe("journal/2026-06-30.md");
    expect(await readFile(path.join(root, journal.path), "utf8")).toContain("# 2026-06-30");
  });
});

describe("applyCheckinPlan", () => {
  test("dry-run previews without mutating backlog or journal", async () => {
    const root = await createFixture();
    const before = await readFile(path.join(root, "backlog.md"), "utf8");

    const preview = await applyCheckinPlan(root, { date: "2026-06-30", selected_task_ids: ["J-001"] }, { dryRun: true });

    expect(preview).toMatchObject({ action: "preview_checkin", changed_paths: ["backlog.md", "journal/2026-06-30.md"] });
    expect(await readFile(path.join(root, "backlog.md"), "utf8")).toBe(before);
  });

  test("moves selected backlog tasks into today's Todo", async () => {
    const root = await createFixture();

    await applyCheckinPlan(root, {
      date: "2026-06-30",
      capacity: "normal",
      primary_outcome: "Ship v0.3",
      selected_task_ids: ["J-001"],
      task_plans: [{ task_id: "J-001", first_step: "Run tests" }],
    });

    const backlog = await readFile(path.join(root, "backlog.md"), "utf8");
    const journal = await readFile(path.join(root, "journal", "2026-06-30.md"), "utf8");
    expect(backlog).not.toContain("J-001");
    expect(journal).toContain("- [ ] [J-001] Backlog task");
    expect(journal).toContain("- primary_outcome: Ship v0.3");
    expect(journal).toContain("### Plan: [J-001]");
  });

  test("recommits latest carryover task and records audit in prior checkout", async () => {
    const root = await createFixture();
    await writeFile(path.join(root, "journal", "2026-06-29.md"), "# 2026-06-29\n\n## Todo\n\n- [ ] [J-009] Prior task\n\n## Notes\n\n## Checkout\n\n- task_decisions:\n", "utf8");

    await applyCheckinPlan(root, {
      date: "2026-06-30",
      carryover: [{ from: "journal/2026-06-29.md", task_id: "J-009", disposition: "recommit" }],
    });

    const prior = await readFile(path.join(root, "journal", "2026-06-29.md"), "utf8");
    const today = await readFile(path.join(root, "journal", "2026-06-30.md"), "utf8");
    expect(today).toContain("- [ ] [J-009] Prior task");
    expect(prior).toContain("[J-009] carried forward by /checkin on 2026-06-30");
  });
});

describe("applyCheckoutPlan", () => {
  test("marks completed tasks and writes checkout reflection", async () => {
    const root = await createFixture();
    await writeFile(path.join(root, "journal", "2026-06-30.md"), "# 2026-06-30\n\n## Check-in\n\n## Todo\n\n- [ ] [J-001] Task\n\n## Notes\n\n## Checkout\n\n- wellbeing:\n- worked:\n- improve:\n- handoff:\n- next_step:\n- task_decisions:\n- digest:\n", "utf8");

    await applyCheckoutPlan(root, {
      date: "2026-06-30",
      completed_task_ids: ["J-001"],
      wellbeing: "4",
      worked: "Focused block helped",
      improve: "Start earlier",
      handoff: "Tests pass",
      next_step: "Review diff",
      digest: ["journal_only: kept temporal notes here"],
    });

    const journal = await readFile(path.join(root, "journal", "2026-06-30.md"), "utf8");
    expect(journal).toContain("- [x] [J-001] Task");
    expect(journal).toContain("- wellbeing: 4");
    expect(journal).toContain("  - [J-001] completed");
    expect(journal).toContain("  - journal_only: kept temporal notes here");
  });
});
