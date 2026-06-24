import { describe, expect, test } from "vitest";
import { classifyPath, compareDocumentPaths } from "./classify.js";

describe("classifyPath", () => {
  test.each([
    ["README.MD", null],
    ["notes.md.bak", null],
    [".scratch.md", "inbox"],
    ["brain/archive.md", "wiki"],
    ["brain/archive/a.md", "archive"],
    ["brainx/example.md", null],
    ["docs/example.md", null],
    ["AGENTS.md", "protected_root"],
    ["agents.md", "inbox"],
  ] as const)("classifies %s", (relativePath, expected) => {
    expect(classifyPath(relativePath)).toBe(expected);
  });
});

describe("compareDocumentPaths", () => {
  test("sorts paths by raw code-point order", () => {
    const paths = ["brain/b.md", "brain/A.md", "AGENTS.md", "brain/a.md"];

    expect([...paths].sort(compareDocumentPaths)).toEqual([
      "AGENTS.md",
      "brain/A.md",
      "brain/a.md",
      "brain/b.md",
    ]);
  });
});
