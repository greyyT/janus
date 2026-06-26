import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  DIGEST_LEDGER_RELATIVE_PATH,
  compareDigestLedgerPaths,
  initializeDigestLedger,
  parseDigestLedger,
  renderDigestLedger,
} from "./digest.js";

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "janus-digest-"));
  await writeFile(path.join(root, "package.json"), "{}", "utf8");
  await writeFile(path.join(root, "AGENTS.md"), "# Agents", "utf8");
  return root;
}

describe("renderDigestLedger", () => {
  test("renders an empty inbox ledger", () => {
    expect(renderDigestLedger([])).toBe("# Janus Digest Ledger\n\n");
  });

  test("renders inbox paths as one unchecked checklist", () => {
    expect(renderDigestLedger([
      {
        path: "b.md",
        title: "B",
        age_days: 0,
        age_source: "filesystem_mtime",
        frontmatter_warnings: [],
      },
      {
        path: "a.md",
        title: "A",
        age_days: 0,
        age_source: "filesystem_mtime",
        frontmatter_warnings: [],
      },
    ])).toBe("# Janus Digest Ledger\n\n- [ ] b.md\n- [ ] a.md\n");
  });
});

describe("parseDigestLedger", () => {
  test("parses checked status plus disposition labels", () => {
    expect(parseDigestLedger([
      "# Janus Digest Ledger",
      "",
      "- [ ] note-a.md",
      "- [x] note-b.md — clarified",
      "- [x] note-c.md — parked",
      "- [x] note-d.md — keep raw",
      "- [x] note-e.md — proposed discard",
    ].join("\n"))).toEqual([
      { path: "note-a.md", checked: false },
      { path: "note-b.md", checked: true, disposition: "clarified" },
      { path: "note-c.md", checked: true, disposition: "parked" },
      { path: "note-d.md", checked: true, disposition: "keep raw" },
      { path: "note-e.md", checked: true, disposition: "proposed discard" },
    ]);
  });

  test("detects ledger path mismatch", () => {
    expect(compareDigestLedgerPaths(["old.md", "same.md"], ["new.md", "same.md"])).toEqual({
      matches: false,
      addedPaths: ["new.md"],
      removedPaths: ["old.md"],
    });
  });
});

describe("initializeDigestLedger", () => {
  test("creates a ledger from root inbox notes only", async () => {
    const root = await createFixture();
    await mkdir(path.join(root, "brain"), { recursive: true });
    await mkdir(path.join(root, "journal"), { recursive: true });
    await writeFile(path.join(root, "README.md"), "# Readme", "utf8");
    await writeFile(path.join(root, "b.md"), "# B", "utf8");
    await writeFile(path.join(root, "a.md"), "# A", "utf8");
    await writeFile(path.join(root, "brain", "HOME.md"), "# Home", "utf8");
    await writeFile(path.join(root, "journal", "2026-06-26.md"), "# Journal", "utf8");

    const result = await initializeDigestLedger(root);
    const content = await readFile(path.join(root, DIGEST_LEDGER_RELATIVE_PATH), "utf8");

    expect(result).toEqual({
      action: "created",
      ledger_path: DIGEST_LEDGER_RELATIVE_PATH,
      inbox_count: 2,
    });
    expect(content).toBe("# Janus Digest Ledger\n\n- [ ] a.md\n- [ ] b.md\n");
  });

  test("creates an empty ledger when the inbox queue is empty", async () => {
    const root = await createFixture();

    const result = await initializeDigestLedger(root);
    const content = await readFile(path.join(root, DIGEST_LEDGER_RELATIVE_PATH), "utf8");

    expect(result.inbox_count).toBe(0);
    expect(content).toBe("# Janus Digest Ledger\n\n");
  });

  test("preserves an existing ledger without reset", async () => {
    const root = await createFixture();
    const ledgerPath = path.join(root, DIGEST_LEDGER_RELATIVE_PATH);
    await mkdir(path.dirname(ledgerPath), { recursive: true });
    await writeFile(ledgerPath, "# Janus Digest Ledger\n\n- [x] old.md — clarified\n", "utf8");
    await writeFile(path.join(root, "new.md"), "# New", "utf8");

    const result = await initializeDigestLedger(root);
    const content = await readFile(ledgerPath, "utf8");

    expect(result).toEqual({
      action: "resumed",
      ledger_path: DIGEST_LEDGER_RELATIVE_PATH,
      inbox_count: 1,
    });
    expect(content).toBe("# Janus Digest Ledger\n\n- [x] old.md — clarified\n");
  });

  test("overwrites an existing ledger with reset", async () => {
    const root = await createFixture();
    const ledgerPath = path.join(root, DIGEST_LEDGER_RELATIVE_PATH);
    await mkdir(path.dirname(ledgerPath), { recursive: true });
    await writeFile(ledgerPath, "# Janus Digest Ledger\n\n- [x] old.md — clarified\n", "utf8");
    await writeFile(path.join(root, "new.md"), "# New", "utf8");

    const result = await initializeDigestLedger(root, { reset: true });
    const content = await readFile(ledgerPath, "utf8");

    expect(result).toEqual({
      action: "reset",
      ledger_path: DIGEST_LEDGER_RELATIVE_PATH,
      inbox_count: 1,
    });
    expect(content).toBe("# Janus Digest Ledger\n\n- [ ] new.md\n");
  });

  test("does not read brain or journal directories when initializing", async () => {
    const root = await createFixture();
    const brainPath = path.join(root, "brain");
    const journalPath = path.join(root, "journal");
    await mkdir(brainPath, { recursive: true });
    await mkdir(journalPath, { recursive: true });
    await writeFile(path.join(root, "note.md"), "# Note", "utf8");
    await chmod(brainPath, 0);
    await chmod(journalPath, 0);

    try {
      const result = await initializeDigestLedger(root);
      expect(result.inbox_count).toBe(1);
    } finally {
      await chmod(brainPath, 0o700);
      await chmod(journalPath, 0o700);
    }
  });

  test("preserves the prior ledger when reset write fails", async () => {
    const root = await createFixture();
    const ledgerPath = path.join(root, DIGEST_LEDGER_RELATIVE_PATH);
    const ledgerDirectory = path.dirname(ledgerPath);
    await mkdir(ledgerDirectory, { recursive: true });
    await writeFile(ledgerPath, "# Janus Digest Ledger\n\n- [x] old.md — clarified\n", "utf8");
    await writeFile(path.join(root, "new.md"), "# New", "utf8");
    await chmod(ledgerDirectory, 0o500);

    try {
      await expect(initializeDigestLedger(root, { reset: true })).rejects.toThrow();
      await expect(readFile(ledgerPath, "utf8")).resolves.toBe("# Janus Digest Ledger\n\n- [x] old.md — clarified\n");
    } finally {
      await chmod(ledgerDirectory, 0o700);
    }
  });
});
