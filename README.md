# Janus

Janus is my Markdown-first engineering OS.

This repo is meant to be the first place an agent opens at the start of a working session. The agent spawned here should act as the orchestrator for the rest of the work: read the current state, recover prior decisions, understand what I was doing last time, and decide which project-specific instructions apply before touching code elsewhere.

It is also my second brain. I want to be able to dump rough notes, links, decisions, project ideas, daily context, and unfinished thoughts without spending time classifying everything up front. Some knowledge will overlap. That is fine. Janus handles overlap through location rules, source-of-truth rules, and project-specific instructions rather than forcing every note into a perfect taxonomy on day one.

The long-term goal is simple: when I start a session, Janus should already know where to look, what matters, what is still rough, and what rules the agent should follow for the project in front of it.

## what Janus is for

Janus keeps four kinds of Markdown memory separate.

`journal/` is daily working memory. It holds dated notes like `journal/2026-06-25.md`, with morning check-in context, committed task blocks, loose notes, links, and checkout reflections including wellbeing.

`backlog.md` is the protected root queue of unresolved, uncommitted tasks. Tasks move from backlog into a day's journal only when `/checkin` commits them.

Root Markdown files are inbox captures. These are standalone thoughts that deserve their own title, source context, or likely promotion path. They can be incomplete or wrong. They are allowed to be messy.

`brain/` is durable knowledge. Notes in `brain/` should be maintained, linked from the right project page, and treated as more deliberate than root inbox notes.

Markdown remains the source of truth.

## the vision

I do not want Janus to become a dashboard or a task app. I want it to become the operating layer around my engineering work.

In practice, that means:

- every agent session starts from this repo;
- Janus knows the current work, prior decisions, and active project context;
- project pages explain how an agent should behave for that project;
- commands and instructions make rough notes usable without requiring manual organization first;
- durable knowledge gets promoted into `brain/` when it earns that status;
- generated indexes help agents navigate, but never replace the Markdown.

The important part is the boundary. I should be able to drop anything into Janus quickly, then rely on agents and repo rules to sort out how that information should be interpreted later.

## current state

Janus is currently at v0.3.

It supports:

- root inbox notes;
- protected `backlog.md` task capture with stable `J-###` IDs;
- daily journal notes in `journal/YYYY-MM-DD.md`;
- an Obsidian journal template at `templates/journal.md`;
- optional read-only Google/iCalendar feed planning configured in `.janus/calendar/config.json`;
- tests for the brain tooling.

## repository map

```text
janus/
├── AGENTS.md
├── README.md
├── backlog.md
├── journal/
│   ├── .gitkeep
│   └── YYYY-MM-DD.md
├── brain/
│   ├── HOME.md
│   └── projects/
│       └── janus/
│           ├── INDEX.md
│           ├── architecture.md
│           ├── journal-workflow.md
│           ├── daily-workflow.md
│           ├── vision.md
│           ├── digest-workflow.md
│           ├── decisions/
│           └── sketches/
├── templates/
│   └── journal.md
└── tools/
    └── brain/
```

## daily workflow

Capture future work with `/add-task`. It appends a task block to `backlog.md` and allocates the next stable task ID.
The default flow creates a strict root `task-create.md` scratch file, waits for the user to fill it and reply `done`, then creates the backlog task directly and deletes the scratch file on success.

Start the day with `/checkin`. It creates today's journal note if missing, reconciles unfinished tasks from the latest prior journal, reads backlog and optional calendar context, asks for missing judgment, and commits selected task blocks into today's `## Todo`.

During the day, use:

```text
journal/YYYY-MM-DD.md
```

for committed work and notes.

End the day with `/checkout`. It marks completed task blocks `[x]`, leaves unfinished task blocks unchecked, writes wellbeing and reflection under `## Checkout`, and reviews the daily note for selective digest actions.

The journal template contains:

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

Janus does not automatically roll unfinished tasks into tomorrow. The next `/checkin` explicitly recommits, returns, splits, cancels, or completes prior unfinished tasks.

## commands
See [`commands.md`](commands.md) for the maintained command reference generated from `package.json` scripts.

Install dependencies:

```sh
pnpm install
```

Configure optional read-only calendar availability:

```sh
pnpm brain:calendar:add -- --url "webcal://calendar.google.com/calendar/ical/.../basic.ics" --name "Work" --json
pnpm brain:calendar -- --date YYYY-MM-DD --json
```

Run tests:

```sh
pnpm test
```

Type-check the tooling:

```sh
pnpm exec tsc --noEmit
```

## how the commands behave

`brain:calendar:add` stores read-only iCalendar feed links in gitignored `.janus/calendar/config.json`. `brain:calendar` live-fetches configured feeds, returns calendar-labeled events and merged busy blocks for the planning day, and falls back to legacy `.janus/calendar/primary.ics` only when no feed list is configured. Missing or unreachable calendar input produces an unavailable state or warnings instead of blocking `/checkin`.

## source of truth

When two pieces of information disagree, use this order:

1. Source code and repository-local documentation.
2. Promoted Janus wiki notes under `brain/`.
3. Journal notes under `journal/` as chronological records.
4. Root inbox notes.
5. Generated indexes and summaries.

Root inbox notes and journal notes can be rough. Durable claims should move into `brain/` after they are checked.

## future agent workflow

Right now, Janus relies on harness-native commands and small deterministic scripts. An agent working inside Janus should be able to:

- inspect the inbox at the start of a session;
- refresh the index when Markdown changes;
- read today's journal before starting work;
- guide the user through morning check-ins and evening checkouts;
- surface unfinished tasks and project follow-ups;
- choose the right project instructions before acting;
- promote durable knowledge into `brain/` with links back to the project page.

That agent is Janus in the fuller sense: an orchestrator that keeps my engineering context warm across sessions, backed by small scripts when scripts are enough.

## non-goals for now

Janus is not trying to be a database, a dashboard, a notification system, or a full task manager.

v0.3 intentionally avoids automatic task rollover, automatic scheduling, priorities, reminders, graphs, embeddings, semantic search, and Obsidian plugin code. The current system stays boring: Markdown first, small commands, clear rules.
