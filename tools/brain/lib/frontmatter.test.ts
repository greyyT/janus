import { describe, expect, test } from "vitest";
import { parseFrontmatter } from "./frontmatter.js";

describe("parseFrontmatter", () => {
  test("parses flat key-value entries and values containing colons", () => {
    const result = parseFrontmatter("---\nproject: janus\nkey: value: with colon\nempty:   \n---\n# Body");

    expect(result.frontmatter).toEqual({
      project: "janus",
      key: "value: with colon",
      empty: "",
    });
    expect(result.body).toBe("# Body");
    expect(result.warnings).toEqual([]);
  });

  test("warns on duplicate keys and keeps the last valid value", () => {
    const result = parseFrontmatter("---\nproject: old\nproject: janus\n---\n# Body");

    expect(result.frontmatter.project).toBe("janus");
    expect(result.warnings).toEqual([
      {
        code: "duplicate_frontmatter_key",
        line: 3,
        message: 'duplicate frontmatter key "project"; last value wins',
      },
    ]);
  });

  test("continues parsing after malformed lines in a closed block", () => {
    const result = parseFrontmatter("---\nproject: janus\nnot valid metadata\nstatus: active\n---\n# Body");

    expect(result.frontmatter).toEqual({
      project: "janus",
      status: "active",
    });
    expect(result.warnings).toEqual([
      {
        code: "malformed_frontmatter",
        line: 3,
        message: "expected key: value",
      },
    ]);
  });

  test("treats unclosed frontmatter as body and ignores metadata", () => {
    const content = "---\nproject: janus\n\n# My actual note";
    const result = parseFrontmatter(content);

    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe(content);
    expect(result.warnings).toEqual([
      {
        code: "malformed_frontmatter",
        message: "unclosed frontmatter block",
      },
    ]);
  });

  test("does not recognize frontmatter after a UTF-8 BOM", () => {
    const content = "\uFEFF---\nproject: janus\n---\n# Body";
    const result = parseFrontmatter(content);

    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe(content);
    expect(result.warnings).toEqual([]);
  });
});
