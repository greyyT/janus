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

At the start of the day, `/checkin` creates or opens today's note and writes morning planning context.

During the day, use the journal note for:

- committed task blocks under `## Todo`;
- unstructured notes and captures;
- lightweight project follow-ups;
- random thoughts and links;
- short decision records.

At the end of the day, `/checkout`:

- marks completed active tasks `[x]`;
- leaves unfinished active tasks unchecked;
- records wellbeing and reflection under `## Checkout`;
- writes handoff and next-step context;
- reviews the daily note for selective digest actions.

Janus does not automatically roll tasks forward. The next `/checkin` explicitly recommits, returns, splits, cancels, or completes unfinished tasks from the latest prior journal containing active tasks.

## Required sections

The journal template contains these top-level working sections:

```md
## Check-in

- capacity:
- primary_outcome:
- calendar_summary:
- constraints:

## Todo

- [ ]

## Notes

## Checkout

- wellbeing:
- worked:
- improve:
- handoff:
- next_step:
- task_decisions:
- digest:
```

`## Check-in` contains morning context and optional day-specific plans. It is not an active task list.

`## Todo` contains active task blocks committed to that day. A task block is the top-level checkbox line containing `[J-###]` plus its indented Markdown body. Completed tasks remain in the note as historical evidence.

`## Notes` is deliberately unstructured. It may contain bullets, prose, links, code snippets, references to other notes, and lower-level headings. `/checkout` reviews this section for selective digest actions, but not every note creates another artifact.

`## Checkout` contains end-of-day closure: wellbeing, reflection, handoff, task decisions, and digest audit.

## Wellbeing reflection

Wellbeing is now journal content, not a reporting CLI metric.

Valid checkout entries use this form inside the exact `## Checkout` section:

```md
- wellbeing: 3
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

## Task movement

`backlog.md` holds unresolved, uncommitted tasks. A journal `## Todo` holds tasks committed to that day.

`/checkin` may move task blocks from `backlog.md` into today's journal, recommit unfinished prior tasks, return them to backlog, split them into fresh IDs, mark them complete, or cancel them.

`/checkout` never moves unfinished tasks back to backlog. It marks completed tasks and leaves unfinished tasks for the next `/checkin` to reconcile.

## Boundaries

Use `journal/` for daily chronological working memory.

Use `backlog.md` for unresolved tasks that are not committed to a day.

Use root Markdown files for standalone inbox captures that deserve their own title, source context, or likely promotion path.

Use `brain/` for promoted durable knowledge.

Do not place journal workflow documentation inside `journal/`.
