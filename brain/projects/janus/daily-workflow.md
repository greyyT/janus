---
title: Daily Planning Workflow
created: 2026-06-30
kind: system
---

# Daily Planning Workflow

Janus v0.3 turns the daily journal into a deliberate planning loop without becoming a general task manager.

```text
capture task -> backlog queue
backlog + prior-day context + calendar -> /checkin
today's active work + notes -> /checkout
checkout -> reflection, handoff, task reconciliation, daily-note digest
```

## Files

- `backlog.md` is the canonical queue of unresolved, uncommitted tasks.
- `journal/YYYY-MM-DD.md` is the canonical daily working record.
- `templates/journal.md` creates the v0.3 journal shape.
- `.janus/calendar/config.json` stores optional read-only iCalendar feed links, global planning hours, and timezone; legacy `.janus/calendar/primary.ics` remains a local fallback when no feed list is configured.

## Active task invariant

An active task is the complete top-level Markdown checkbox block containing `[J-###]`.

Each open task ID exists in exactly one active location:

- `backlog.md`; or
- one journal's `## Todo` section.

Task references under `## Check-in`, `## Checkout`, and historical notes are audit references, not active task copies.

## Backlog tasks

`backlog.md` starts with the allocation comment:

```md
<!-- janus-backlog: next_task_id=1 -->
```

`pnpm brain:task:add` allocates the current number, creates a zero-padded ID such as `J-001`, then increments the counter. IDs are never reused.

Task blocks preserve user-owned indented Markdown. The supported parseable estimate values are:

```text
quick
medium
large
```

## `/add-task`

`/add-task` defaults to a strict file-first flow:

1. Create or resume root `task-create.md` through `pnpm brain:task:pending`.
2. Wait for the user to fill it and reply `done`.
3. Parse and normalize the form.
4. Ask only when intent is ambiguous.
5. Create the task directly through `pnpm brain:task:add -- --form task-create.md`.
6. Delete `task-create.md` after successful creation.

The stored optional fields are:

- `project` constrained to a known `brain/projects/*` slug;
- `deadline`;
- `estimate`;
- `blocked_by`;
- `context`;
- `references`.

## `/checkin`

`/checkin` is the morning planning flow:

1. Create or open today's journal through `pnpm brain:journal:create -- --date YYYY-MM-DD --json`.
2. Scan the latest prior journal containing unfinished active tasks.
3. Reconcile each unfinished task by recommitting it, returning it to backlog, marking it complete, splitting it, or cancelling it.
4. Read remaining backlog tasks.
5. Read optional calendar availability.
6. Recommend a daily plan with reasons.
7. For selected substantial or ambiguous tasks, brainstorm the approach before distilling the structured task plan.
8. Preview one structured apply plan with `pnpm brain:task:checkin -- --dry-run --json`.
9. Apply the same plan after approval.

Unfinished tasks are not automatically rolled forward. The next `/checkin` must explicitly choose what happens to each one.

### Open check-in improvements

The day-level `/checkin` planning flow is working acceptably. The current improvement target is the per-task planning interaction after a task has already been selected.

For substantial or ambiguous selected tasks, `/checkin` uses a two-stage per-task planning flow:

1. Ask one open brainstorm question about how to approach the selected task.
2. Distill the answer into the existing structured planning fields: `done_for_today`, `first_step`, `steps`, `risks`, and `stopping_point`.
3. Ask the user to correct the structured task plan before applying it.

This applies to every selected task with estimate `medium` or `large`, and to `quick` tasks whose title or context does not already make the first step and acceptance condition obvious. Straightforward `quick` tasks can skip the brainstorm.

This keeps the journal task-plan format consistent while avoiding narrow field-by-field questioning too early.

Daily note creation is a deterministic package command: `pnpm brain:journal:create -- --date YYYY-MM-DD --json`. `/checkin` calls that command automatically instead of manually checking whether the daily note exists and writing the template itself. The daily-note command creates or returns today's note idempotently; `/checkin` separately enforces the “one check-in per day” workflow rule.

Related but separate: `/checkout` prompt clarity may need its own review. Calendar-unavailable behavior is not part of this improvement.

## `/checkout`

`/checkout` is the end-of-day closure flow:

1. Mark completed active tasks `[x]` in today's journal.
2. Leave unfinished active tasks unchecked in today's journal.
3. Preserve the user's filled `## Checkout` freeform subsections.
4. Ask clearer structured checkout questions with suggestions for wellbeing, handoff, next step, task completion, and digest dispositions.
5. Write structured checkout fields under `## Checkout`.
6. Review the daily note and assign digest dispositions.
7. Create root inbox captures or propose durable `brain/` edits only when the daily note contains knowledge worth extracting.

Every checkout reviews the daily note. Not every checkout creates a new note or durable edit.

## Calendar input

Calendar support is read-only and optional. `pnpm brain:calendar:add -- --url "webcal://calendar.google.com/calendar/ical/.../basic.ics" --name "Work" --json` stores feed configuration under gitignored `.janus/calendar/config.json`.

`pnpm brain:calendar -- --date YYYY-MM-DD --json` live-fetches configured iCalendar feeds, labels events by calendar, and merges all busy intervals into one planning availability object. If no feed list is configured, it falls back to legacy `.janus/calendar/primary.ics`.

Calendar unavailability never blocks `/checkin`; the agent asks for missing capacity and constraints instead.

## Commands

```sh
pnpm brain:calendar -- --date YYYY-MM-DD --json
pnpm brain:calendar:add -- --url "webcal://calendar.google.com/calendar/ical/.../basic.ics" --name "Work" --json
pnpm brain:journal:create -- --date YYYY-MM-DD --json
pnpm brain:task:pending -- --json
pnpm brain:task:add -- --title "Task" --dry-run --json
pnpm brain:task:add -- --form task-create.md --json
pnpm brain:task:list -- --json
pnpm brain:task:move -- --from backlog --to today J-001 --dry-run --json
pnpm brain:task:checkin -- --plan plan.json --dry-run --json
pnpm brain:task:checkout -- --date YYYY-MM-DD --dry-run --json
```

Mutating task commands support `--dry-run --json` previews for slash workflows.
