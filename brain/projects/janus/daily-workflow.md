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
- `.janus/calendar/primary.ics` and `.janus/calendar/config.json` are optional local calendar inputs and are not committed.

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

`/add-task` asks only for the information needed to preserve future context, then appends a task to `backlog.md` through `pnpm brain:task:add`.

Only the title is required. Deadline, estimate, blockers, references, and context are optional.

## `/checkin`

`/checkin` is the morning planning flow:

1. Create today's journal when missing.
2. Scan the latest prior journal containing unfinished active tasks.
3. Reconcile each unfinished task by recommitting it, returning it to backlog, marking it complete, splitting it, or cancelling it.
4. Read remaining backlog tasks.
5. Read optional calendar availability.
6. Recommend a daily plan with reasons.
7. Preview one structured apply plan with `pnpm brain:task:checkin -- --dry-run --json`.
8. Apply the same plan after approval.

Unfinished tasks are not automatically rolled forward. The next `/checkin` must explicitly choose what happens to each one.

## `/checkout`

`/checkout` is the end-of-day closure flow:

1. Mark completed active tasks `[x]` in today's journal.
2. Leave unfinished active tasks unchecked in today's journal.
3. Write reflection fields under `## Checkout`.
4. Review the daily note and assign digest dispositions.
5. Create root inbox captures or propose durable `brain/` edits only when the daily note contains knowledge worth extracting.

Every checkout reviews the daily note. Not every checkout creates a new note or durable edit.

## Calendar input

Calendar support is read-only and local. `pnpm brain:calendar -- --date YYYY-MM-DD --json` returns either an unavailable state or a planning-day summary with events, merged busy intervals, and free blocks inside configured planning hours.

Calendar unavailability never blocks `/checkin`; the agent asks for missing capacity and constraints instead.

## Commands

```sh
pnpm brain:calendar -- --date YYYY-MM-DD --json
pnpm brain:task:add -- --title "Task" --dry-run --json
pnpm brain:task:list -- --json
pnpm brain:task:move -- --from backlog --to today J-001 --dry-run --json
pnpm brain:task:checkin -- --plan plan.json --dry-run --json
pnpm brain:task:checkout -- --date YYYY-MM-DD --dry-run --json
```

Mutating task commands support `--dry-run --json` previews for slash workflows.
