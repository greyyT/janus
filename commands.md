# Commands

Short reference for scripts declared in `package.json`.

## Syntax

Pass script variables after `--`:

```sh
pnpm <script> -- <variables>
```

## Scripts

| Script | Target | Variables |
| --- | --- | --- |
| `brain:inbox` | `tsx tools/brain/inbox.ts` | `--json` |
| `brain:index` | `tsx tools/brain/index.ts` | `--json` |
| `brain:digest:init` | `tsx tools/brain/digest-init.ts` | `--reset` |
| `brain:calendar` | `tsx tools/brain/calendar.ts` | `--date YYYY-MM-DD`, `--json` |
| `brain:calendar:add` | `tsx tools/brain/calendar-add.ts` | `--url URL`, `--name TEXT`, `--timezone TZ`, `--json` |
| `brain:journal:create` | `tsx tools/brain/journal-create.ts` | `--date YYYY-MM-DD`, `--json` |
| `brain:task:pending` | `tsx tools/brain/task-pending.ts` | `--json` |
| `brain:task:add` | `tsx tools/brain/task-add.ts` | `--form PATH`, `--title TEXT`, `--project SLUG`, `--added TEXT`, `--estimate quick\\|medium\\|large`, `--deadline TEXT`, `--blocked-by TEXT`, `--context TEXT`, `--reference TEXT`, `--dry-run`, `--json` |
| `brain:task:list` | `tsx tools/brain/task-list.ts` | `--json` |
| `brain:task:move` | `tsx tools/brain/task-move.ts` | `--from LOCATION`, `--to LOCATION`, `J-###`, `--date YYYY-MM-DD`, `--dry-run`, `--json` |
| `brain:task:checkin` | `tsx tools/brain/task-checkin.ts` | `--plan PATH`, `--plan-json JSON`, `--dry-run`, `--json` |
| `brain:task:checkout` | `tsx tools/brain/task-checkout.ts` | `--date YYYY-MM-DD`, `--completed J-###`, `--wellbeing TEXT`, `--worked TEXT`, `--improve TEXT`, `--handoff TEXT`, `--next-step TEXT`, `--digest TEXT`, `--dry-run`, `--json` |
| `test` | `vitest run` | Janus defines none; pass Vitest args after `--`. |

## Variables

### Shared

- `--json`: print JSON.
- `--dry-run`: preview without writing.
- `YYYY-MM-DD`: semantic calendar date.
- `J-###`: task ID, for example `J-001`.
- `TEXT`: one shell argument; quote values containing spaces.
- `URL`: one shell argument; quote calendar feed URLs.
- `TZ`: IANA time zone, for example `Asia/Ho_Chi_Minh`.

### `brain:calendar`

- `--date YYYY-MM-DD`: date to inspect. Default: today.
- Reads configured live iCalendar feeds from `.janus/calendar/config.json`; if no feeds are configured, falls back to legacy `.janus/calendar/primary.ics` when present.

### `brain:calendar:add`

- `--url URL`: required `https://` or `webcal://` iCalendar feed URL. `webcal://` is stored as `https://`.
- `--name TEXT`: optional display label. Default: first unused `Calendar N`.
- `--timezone TZ`: optional global planning time zone written to `.janus/calendar/config.json`.
- `--json`: print `{ action, config_path, calendar, calendar_count }`.

### `brain:journal:create`

- `--date YYYY-MM-DD`: journal date to create or open. Default: today.
- `--json`: print `{ action, path, created }`.

### `brain:digest:init`

- `--reset`: regenerate `.janus/digest-ledger.md` instead of resuming it.

### `brain:task:add`

- `--form PATH`: read task fields from a task-create form. Cannot be combined with direct task fields.
- `--title TEXT`: required unless `--form` is used.
- `--project SLUG`: project slug from `brain/projects/*`.
- `--added TEXT`: task added value. Default: today as `YYYY-MM-DD`.
- `--estimate quick|medium|large`: task estimate.
- `--deadline TEXT`: deadline text.
- `--blocked-by TEXT`: blocker text.
- `--context TEXT`: repeatable context line.
- `--reference TEXT`: repeatable reference line.
- `--dry-run`: preview the new task.
- `--json`: print JSON.

Task-create form fields:

- frontmatter: `title`, `project`, `estimate`, `deadline`, `blocked_by`;
- body sections: `## Context`, `## References`.

### `brain:task:move`

- `--from LOCATION`: required source.
- `--to LOCATION`: required destination.
- `J-###`: required task ID; repeatable.
- `--date YYYY-MM-DD`: date used by `today`. Default: today.
- `--dry-run`: preview the move.
- `--json`: print JSON.
- `LOCATION`: `backlog`, `today`, or `journal:YYYY-MM-DD`.

### `brain:task:checkin`

- `--plan PATH`: read check-in plan JSON from a file.
- `--plan-json JSON`: read check-in plan JSON from the argument.
- `--dry-run`: preview the plan.
- `--json`: print JSON.

Use exactly one of `--plan` or `--plan-json`.

Plan fields:

- `date`: required `YYYY-MM-DD`;
- `capacity`, `primary_outcome`, `calendar_summary`, `constraints`: optional text;
- `selected_task_ids`: optional `J-###` array;
- `task_plans`: optional array of `{ task_id, title, done_for_today, first_step, steps, risks, stopping_point }`;
- `carryover`: optional array of decisions:
  - `{ task_id, from, disposition: "recommit" }`;
  - `{ task_id, from, disposition: "return_to_backlog" }`;
  - `{ task_id, from, disposition: "complete", result? }`;
  - `{ task_id, from, disposition: "cancel", reason? }`;
  - `{ task_id, from, disposition: "split", children }`.

Split child fields:

- task fields from `brain:task:add`;
- `destination`: `today` or `backlog`.

### `brain:task:checkout`

- `--date YYYY-MM-DD`: journal date. Default: today.
- `--completed J-###`: repeatable completed task ID.
- `--wellbeing TEXT`: wellbeing reflection.
- `--worked TEXT`: optional fallback content for `### What worked` when that section does not already exist.
- `--improve TEXT`: optional fallback content for `### What could improve` when that section does not already exist.
- `--handoff TEXT`: handoff note.
- `--next-step TEXT`: next step.
- `--digest TEXT`: repeatable digest note.
- `--dry-run`: preview checkout writes.
- `--json`: print JSON.
