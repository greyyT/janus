import { describe, expect, test } from "vitest";
import { parseTaskCreateForm, renderTaskCreateTemplate } from "./task-form.js";

describe("renderTaskCreateTemplate", () => {
  test("includes known project slugs in the template", () => {
    expect(renderTaskCreateTemplate(["janus", "ronin"])).toContain("Known project slugs: janus, ronin");
  });
});

describe("parseTaskCreateForm", () => {
  test("parses a valid task-create form and normalizes project casing", () => {
    const parsed = parseTaskCreateForm(`---
title: Improve add task flow
project: Janus
estimate: medium
deadline: 2026-07-03
blocked_by: Tino
---

# Task Create

## Context

- Keep capture fast
- Preserve project context

## References

- journal/2026-07-01.md
`, ["janus"]);

    expect(parsed.task).toEqual({
      title: "Improve add task flow",
      project: "janus",
      estimate: "medium",
      deadline: "2026-07-03",
      blockedBy: "Tino",
      context: ["Keep capture fast", "Preserve project context"],
      references: ["journal/2026-07-01.md"],
    });
  });

  test("rejects missing title and invalid project", () => {
    expect(() => parseTaskCreateForm(`---
title:
project: unknown
estimate: medium
deadline:
blocked_by:
---

## Context

- One

## References

- Two
`, ["janus"])).toThrow('missing required "title"');
  });

  test("rejects invalid section entries", () => {
    expect(() => parseTaskCreateForm(`---
title: Good
project:
estimate:
deadline:
blocked_by:
---

## Context

not a bullet

## References

- ok
`, ["janus"])).toThrow('invalid context entry "not a bullet"');
  });
});
