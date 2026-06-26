---
title: Journal Workflow
created: 2026-06-25
kind: system
---

# Journal Workflow

Janus uses `journal/` for chronological daily working memory.

Daily journals are Markdown files named:

```text
journal/YYYY-MM-DD.md
```

The filename date is the canonical journal date. Journal frontmatter is useful metadata, but it is not the source of truth for journal identity.

## Daily workflow

At the start of the day, open or create today's note in Obsidian using the Daily Notes plugin.

During the day, use the journal note for:

- the day's task list;
- unstructured notes and captures;
- lightweight project follow-ups;
- random thoughts and links;
- short decision records;
- one optional wellbeing check-in.

At the end of the day:

- mark completed todo items;
- leave incomplete tasks in place;
- manually copy forward only tasks still worth doing tomorrow;
- record the wellbeing score when appropriate.

Janus v0.1 does not roll tasks forward automatically.

## Required sections

The journal template contains these top-level working sections:

```md
## Todo

- [ ]

## Notes

## Check-in

- wellbeing:
```

`## Todo` uses ordinary Markdown checkboxes. Completed tasks remain in the note.

`## Notes` is deliberately unstructured. It may contain bullets, prose, links, code snippets, references to other notes, and lower-level headings. Janus v0.1 does not parse this section.

`## Check-in` is the only journal section parsed by tracking tooling.

## Wellbeing metric

The first supported tracking metric is:

```text
wellbeing: 1-5
```

Suggested interpretation:

```text
1 -> very difficult day
2 -> low / strained
3 -> okay / neutral
4 -> good
5 -> very good
```

This is a subjective self-reporting scale. It is not a mental-health assessment.

Janus must not diagnose, infer risk, prescribe actions, or classify mental-health status from this score.

## Check-in syntax

Valid entries use this form inside the exact `## Check-in` section:

```md
- wellbeing: 3
```

Blank or missing wellbeing values are not recorded and do not warn.

Invalid values warn but do not fail reporting.

If more than one valid wellbeing value appears in a check-in section, the last valid value wins and Janus emits one duplicate warning.

## Future metrics

Future metrics should use the same section and bullet shape:

```md
## Check-in

- wellbeing: 3
- sleep_quality: 4
- energy: 2
```

v0.1 recognizes only `wellbeing`. Adding another metric should require adding a metric definition in code, not changing the journal Markdown structure or migrating old notes.

## Boundaries

Use `journal/` for daily chronological working memory.

Use root Markdown files for standalone inbox captures that deserve their own title, source context, or likely promotion path.

Use `brain/` for promoted durable knowledge.

Do not place journal workflow documentation inside `journal/`.
