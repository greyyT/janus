import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { discoverMarkdownFiles, resolveRepositoryRoot, toPosixRelativePath } from "./filesystem.js";

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "janus-fs-"));
  await writeFile(path.join(root, "package.json"), "{}", "utf8");
  await writeFile(path.join(root, "AGENTS.md"), "# Agents", "utf8");
  return root;
}

describe("resolveRepositoryRoot", () => {
  test("walks upward until package.json and AGENTS.md are both present", async () => {
    const root = await createFixture();
    const nested = path.join(root, "tools", "brain");
    await mkdir(nested, { recursive: true });

    await expect(resolveRepositoryRoot(nested)).resolves.toBe(root);
  });

  test("fails when repository markers are missing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "janus-no-root-"));
    await expect(resolveRepositoryRoot(root)).rejects.toThrow("Could not resolve Janus repository root");
  });
});

describe("discoverMarkdownFiles", () => {
  test("discovers only eligible markdown files", async () => {
    const root = await createFixture();
    await mkdir(path.join(root, "brain", "archive"), { recursive: true });
    await mkdir(path.join(root, "docs"), { recursive: true });
    await mkdir(path.join(root, "brainx"), { recursive: true });
    await mkdir(path.join(root, "journal", "nested"), { recursive: true });
    await writeFile(path.join(root, "README.MD"), "# Upper", "utf8");
    await writeFile(path.join(root, "notes.md.bak"), "# Backup", "utf8");
    await writeFile(path.join(root, ".scratch.md"), "# Scratch", "utf8");
    await writeFile(path.join(root, "brain", "archive.md"), "# Archive page", "utf8");
    await writeFile(path.join(root, "brain", "archive", "a.md"), "# A", "utf8");
    await writeFile(path.join(root, "brainx", "example.md"), "# Brainx", "utf8");
    await writeFile(path.join(root, "docs", "example.md"), "# Docs", "utf8");
    await writeFile(path.join(root, "journal", "2026-06-25.md"), "# Journal", "utf8");
    await writeFile(path.join(root, "journal", "random-note.md"), "# Random", "utf8");
    await writeFile(path.join(root, "journal", "nested", "2026-06-25.md"), "# Nested", "utf8");
    await mkdir(path.join(root, "directory.md"));

    const files = await discoverMarkdownFiles(root);

    expect(files.map((file) => file.relativePath).sort()).toEqual([
      ".scratch.md",
      "AGENTS.md",
      "brain/archive.md",
      "brain/archive/a.md",
      "journal/2026-06-25.md",
      "journal/random-note.md",
    ]);
  });

  test("ignores symlinked markdown files when the platform supports symlinks", async () => {
    const root = await createFixture();
    await mkdir(path.join(root, "journal"), { recursive: true });
    const target = path.join(root, "target.txt");
    const rootLink = path.join(root, "linked.md");
    const journalLink = path.join(root, "journal", "linked.md");
    await writeFile(target, "# Target", "utf8");

    try {
      await symlink(target, rootLink);
      await symlink(target, journalLink);
    } catch {
      return;
    }

    const files = await discoverMarkdownFiles(root);

    expect(files.map((file) => file.relativePath)).not.toContain("linked.md");
    expect(files.map((file) => file.relativePath)).not.toContain("journal/linked.md");
  });
});

describe("toPosixRelativePath", () => {
  test("normalizes host separators to POSIX separators", () => {
    const root = path.join("tmp", "janus");
    const absolute = path.join(root, "brain", "HOME.md");

    expect(toPosixRelativePath(root, absolute)).toBe("brain/HOME.md");
  });
});
