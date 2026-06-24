import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { calculateAgeDays, loadBrainDocuments, parseCreatedDate, resolveTitle, titleFromFilename, toInboxDocument } from "./documents.js";

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "janus-docs-"));
  await writeFile(path.join(root, "package.json"), "{}", "utf8");
  await writeFile(path.join(root, "AGENTS.md"), "# Agents", "utf8");
  return root;
}

describe("title resolution", () => {
  test("prefers frontmatter title over H1 and filename", () => {
    expect(resolveTitle({ title: "Frontmatter Title" }, "# Heading", "note-title.md")).toBe("Frontmatter Title");
  });

  test("uses H1 before filename fallback", () => {
    expect(resolveTitle({}, "body\n# Heading Title\n", "note-title.md")).toBe("Heading Title");
  });

  test("creates readable filename fallback", () => {
    expect(titleFromFilename("janus-memory-idea.md")).toBe("Janus memory idea");
    expect(titleFromFilename(".scratch.md")).toBe("Scratch");
  });
});

describe("created dates and age", () => {
  test("accepts only semantic YYYY-MM-DD values", () => {
    expect(parseCreatedDate("2026-06-24")?.toISOString()).toBe("2026-06-24T00:00:00.000Z");
    expect(parseCreatedDate("2026-6-24")).toBeNull();
    expect(parseCreatedDate("2026-02-30")).toBeNull();
  });

  test("calculates whole-day age and clamps future dates to zero", () => {
    const now = new Date("2026-06-24T12:00:00.000Z");

    expect(calculateAgeDays(new Date("2026-06-23T11:59:59.000Z"), now)).toBe(1);
    expect(calculateAgeDays(new Date("2026-06-25T00:00:00.000Z"), now)).toBe(0);
  });
});

describe("loadBrainDocuments", () => {
  test("builds sorted deterministic documents with content hashes", async () => {
    const root = await createFixture();
    await mkdir(path.join(root, "brain", "archive"), { recursive: true });
    await writeFile(path.join(root, "note.md"), "---\nproject: janus\ncreated: 2026-06-24\n---\n# Note", "utf8");
    await writeFile(path.join(root, "brain", "HOME.md"), "# Home", "utf8");
    await writeFile(path.join(root, "brain", "archive", "old.md"), "# Old", "utf8");

    const documents = await loadBrainDocuments(root);

    expect(documents.map((document) => [document.document.path, document.document.location_class])).toEqual([
      ["AGENTS.md", "protected_root"],
      ["brain/HOME.md", "wiki"],
      ["brain/archive/old.md", "archive"],
      ["note.md", "inbox"],
    ]);
    expect(documents.every((document) => /^[a-f0-9]{64}$/.test(document.document.content_hash))).toBe(true);
  });

  test("creates inbox documents with created age and invalid-created warnings", async () => {
    const root = await createFixture();
    await writeFile(path.join(root, "note.md"), "---\nproject: janus\ncreated: 2026-06-24\n---\n# Note", "utf8");
    await writeFile(path.join(root, "bad-date.md"), "---\ncreated: 2026-6-24\n---\n# Bad", "utf8");

    const loadedDocuments = await loadBrainDocuments(root);
    const inboxDocuments = loadedDocuments
      .map((document) => toInboxDocument(document, new Date("2026-06-26T00:00:00.000Z")))
      .filter((document) => document !== null);

    expect(inboxDocuments.find((document) => document.path === "note.md")).toMatchObject({
      project: "janus",
      age_days: 2,
      age_source: "created",
      frontmatter_warnings: [],
    });
    expect(inboxDocuments.find((document) => document.path === "bad-date.md")?.frontmatter_warnings).toEqual([
      'invalid created date "2026-6-24"; expected YYYY-MM-DD',
    ]);
  });
});
