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
| `brain:calendar` | `tsx tools/brain/calendar.ts` | `--date YYYY-MM-DD`, `--json` |
| `brain:calendar:add` | `tsx tools/brain/calendar-add.ts` | `--url URL`, `--name TEXT`, `--timezone TZ`, `--json` |
| `brain:sessions` | `tsx tools/brain/sessions.ts` | `--date YYYY-MM-DD`, `--json` |
| `test` | `vitest run` | Janus defines none; pass Vitest args after `--`. |

## Variables

### Shared

- `--json`: print JSON.
- `YYYY-MM-DD`: semantic calendar date.
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

### `brain:sessions`

- `--date YYYY-MM-DD`: local calendar day to list. Default: today.
- Lists pi transcripts of Janus sessions — sessions whose working directory is the Janus root — with at least one entry on that day. Coordinator sessions run in `coordinator/` and are excluded.
- Reads transcripts from `PI_CODING_AGENT_SESSION_DIR`, else `PI_CODING_AGENT_DIR/sessions`, else `~/.pi/agent/sessions`.
- Coordinator results appear inside these transcripts as user turns wrapped in `<coordinator_result>`; they are coordinator output, not the user's words.
- `--json`: print `{ date, sessions_dir, sessions: [{ path, name, firstActivity, lastActivity }] }`; activity times are ISO timestamps of the first and last entries on that day.
