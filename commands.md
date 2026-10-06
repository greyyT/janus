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
| `brain:book:lookup` | `tsx tools/brain/book-lookup.ts` | exactly one of `--query TEXT`, `--isbn ISBN`, or `--url URL`; optional `--max-depth 1-10`, `--json` |
| `brain:sessions` | `tsx tools/brain/sessions.ts` | `--date YYYY-MM-DD`, `--json` |
| `brain:transcript` | `tsx tools/brain/transcript.ts` | `PATH`, `--raw` |
| `dream` | `tools/dream/dream.sh` | `catch-up`, `--dry-run`, `--prompt PATH` (no `--`) |
| `dream:install` | `tools/dream/install.sh` | none |
| `dream:input` | `tsx tools/dream/input.ts` | `--days "YYYY-MM-DD …"`, `--changes COMMIT`, `--notes-dir PATH` |
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

### `brain:book:lookup`

- Performs a read-only online lookup against Google Books and Open Library; it never mutates the bookshelf.
- Use exactly one of `--query TEXT`, `--isbn ISBN`, or `--url URL`.
- `--url` accepts Google Books and Open Library pages, or an HTTPS URL containing an ISBN.
- `--max-depth 1-10`: maximum rendered TOC depth. Default: `4`.
- Human output renders trustworthy available contents as a `tree`-style fenced text block and cites metadata and TOC sources independently.
- Ambiguous title or edition matches are returned for selection rather than silently resolved.
- Missing trustworthy contents are reported explicitly; the command does not invent chapters.
- `--json`: emit the structured lookup result for agent workflows.

### `brain:sessions`

- `--date YYYY-MM-DD`: local calendar day to list. Default: today.
- Lists pi transcripts of Janus sessions — sessions whose working directory is the Janus root — with at least one entry on that day. Coordinator sessions run in `coordinator/` and are excluded.
- Entries after `/coordinate` turned coordinate mode on (a `janus-coordinate` custom entry) are ignored.
- Reads transcripts from `PI_CODING_AGENT_SESSION_DIR`, else `PI_CODING_AGENT_DIR/sessions`, else `~/.pi/agent/sessions`.
- `--json`: print `{ date, sessions_dir, sessions: [{ path, name, firstActivity, lastActivity }] }`; activity times are ISO timestamps of the first and last entries on that day.

### `brain:transcript`

- `PATH`: required transcript `.jsonl` path, as listed by `brain:sessions`.
- Default view: the conversation on the session's current branch up to the coordinate-mode mark, as `user:` and `janus:` turns; each tool call is one line such as `[Read brain/HOME.md]`. Thinking, tool results, and abandoned branches are left out.
- `--raw`: print the transcript file unchanged.

### `dream`

- Without arguments: dream now if a day is due; this is what launchd runs at 03:00. Run it as `pnpm dream`.
- `--prompt PATH`: use another prompt file instead of `tools/dream/prompt.md`, with the default mode or `--dry-run`; a relative `PATH` is resolved from the Janus root. Run it as `pnpm dream --prompt PATH`.
- `--dry-run`: dream the latest day on a throwaway worktree holding a copy of the uncommitted changes; writes `input.md`, `pr-body.md`, `kept-notes.txt`, and `dream.diff` to `.janus/dream/dry-run/<time>-<prompt>/` and prints the paths. Nothing moves, commits, or pushes, and `.janus/dream/last` is unchanged.
- `catch-up`: report an unseen failed dream, or when a day is due, move the uncommitted changes and finish in the background. Run by `.pi/extensions/dream` before each prompt; pass it as `pnpm dream catch-up`.
- Writes state and logs to `.janus/dream/`. See `docs/dream.md`.

### `dream:install`

- Installs or reinstalls the `com.janus.dream` launchd job for this checkout, keeping the current `PATH`.

### `dream:input`

- Prints, as one Markdown document, everything a dream reads: the uncommitted changes, root notes, the days' Janus conversations, and `## Noticed, not changed` from dream PRs of the previous 30 days. The runner writes it to a file for the model.
- `--days "YYYY-MM-DD …"`: days to gather, separated by spaces or commas. Default: the latest day a dream covers (yesterday, or the day before until 03:00).
- `--changes COMMIT`: commit holding the uncommitted changes, shown as stat and patch. Default: none.
- `--notes-dir PATH`: directory whose root notes are read. Default: the Janus root. Notes Dream kept earlier and that are unchanged (`.janus/dream/kept`) are only named.
- Dream PRs come from `gh pr list`; when it fails, the document says why.
