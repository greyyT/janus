import { describe, expect, test } from "vitest";
import { createInboxJsonOutput, createIndexSummary, getInboxHygieneStatus } from "./output.js";
import { type BrainDocument } from "./documents.js";

describe("getInboxHygieneStatus", () => {
  test.each([
    [0, "healthy"],
    [10, "healthy"],
    [11, "review_soon"],
    [19, "review_soon"],
    [20, "action_required"],
  ] as const)("maps %i inbox notes", (count, status) => {
    expect(getInboxHygieneStatus(count)).toBe(status);
  });
});

describe("createInboxJsonOutput", () => {
  test("returns the stable JSON contract", () => {
    expect(createInboxJsonOutput([
      {
        path: "janus-memory-idea.md",
        title: "Janus memory idea",
        project: "janus",
        age_days: 1,
        age_source: "created",
        frontmatter_warnings: [],
      },
    ])).toEqual({
      inbox_count: 1,
      hygiene_status: "healthy",
      documents: [
        {
          path: "janus-memory-idea.md",
          title: "Janus memory idea",
          project: "janus",
          age_days: 1,
          age_source: "created",
          frontmatter_warnings: [],
        },
      ],
    });
  });
});

describe("createIndexSummary", () => {
  test("summarizes the generated index without returning document bodies", () => {
    const documents: BrainDocument[] = [
      document("AGENTS.md", "protected_root", []),
      document("note.md", "inbox", ["warning"]),
      document("brain/HOME.md", "wiki", []),
      document("brain/archive/old.md", "archive", []),
    ];

    expect(createIndexSummary("data/brain-index.json", documents)).toEqual({
      output_path: "data/brain-index.json",
      document_count: 4,
      counts_by_location_class: {
        protected_root: 1,
        inbox: 1,
        wiki: 1,
        archive: 1,
      },
      warning_count: 1,
    });
  });
});

function document(path: BrainDocument["path"], location_class: BrainDocument["location_class"], frontmatter_warnings: string[]): BrainDocument {
  return {
    path,
    location_class,
    title: path,
    frontmatter: {},
    content_hash: "a".repeat(64),
    frontmatter_warnings,
  };
}
