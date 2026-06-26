import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const CHECKIN = path.resolve("tools/brain/checkin.ts");
const TSX = path.resolve("node_modules/.bin/tsx");

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "janus-cli-"));
  await writeFile(path.join(root, "package.json"), "{}", "utf8");
  await writeFile(path.join(root, "AGENTS.md"), "# Agents", "utf8");
  await mkdir(path.join(root, "journal"), { recursive: true });
  await writeFile(path.join(root, "journal", "2026-06-25.md"), "## Check-in\n- wellbeing: 4", "utf8");
  return root;
}

describe("brain:checkin CLI", () => {
  test("prints human output anchored by --to", async () => {
    const root = await createFixture();
    const result = await runCheckin(root, ["--to", "2026-06-25"]);

    expect(result.stdout).toContain("Wellbeing check-in — 2026-06-19 to 2026-06-25");
    expect(result.stdout).toContain("2026-06-25  4");
    expect(result.stderr).toBe("");
  });

  test("prints exactly one JSON object", async () => {
    const root = await createFixture();
    const result = await runCheckin(root, ["--json", "--to", "2026-06-25"]);

    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      metric: "wellbeing",
      from: "2026-06-19",
      to: "2026-06-25",
      entries: [{ date: "2026-06-25", path: "journal/2026-06-25.md", score: 4 }],
    });
  });

  test.each([
    ["repeated argument", ["--days", "7", "--days", "30"]],
    ["unknown argument", ["--unknown"]],
    ["invalid --to date", ["--to", "invalid-date"]],
  ])("rejects %s", async (_name, args) => {
    const root = await createFixture();

    await expect(runCheckin(root, args)).rejects.toMatchObject({
      stderr: expect.stringContaining(_name),
    });
  });
});

async function runCheckin(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(TSX, [CHECKIN, ...args], { cwd });
  return {
    stdout: result.stdout.trimEnd(),
    stderr: result.stderr.trimEnd(),
  };
}
