# Janus

Janus is my Markdown-first engineering OS.

This repo is meant to be the first place an agent opens at the start of a working session. The agent spawned here should act as the orchestrator for the rest of the work: read the current state, recover prior decisions, understand what I was doing last time, and decide which project-specific instructions apply before touching code elsewhere.

It is also my second brain. I want to be able to dump rough notes, links, decisions, project ideas, daily context, and unfinished thoughts without spending time classifying everything up front. Some knowledge will overlap. That is fine. Janus handles overlap through location rules, source-of-truth rules, and project-specific instructions rather than forcing every note into a perfect taxonomy on day one.

The long-term goal is simple: when I start a session, Janus should already know where to look, what matters, what is still rough, and what rules the agent should follow for the project in front of it.

## what Janus is for

Janus keeps three kinds of memory separate.

`journal/` is daily working memory. It holds dated notes like `journal/2026-06-25.md`, with the day's todo list, loose notes, links, and one optional wellbeing check-in.

Root Markdown files are inbox captures. These are standalone thoughts that deserve their own title, source context, or likely promotion path. They can be incomplete or wrong. They are allowed to be messy.

`brain/` is durable knowledge. Notes in `brain/` should be maintained, linked from the right project page, and treated as more deliberate than root inbox notes.

Generated data under `data/` is disposable. Markdown remains the source of truth.

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

Janus is currently at v0.1.

It supports:

- root inbox notes;
- daily journal notes in `journal/YYYY-MM-DD.md`;
- an Obsidian journal template at `templates/journal.md`;
- durable Janus project docs under `brain/projects/janus/`;
- a generated schema-v2 index at `data/brain-index.json`;
- a wellbeing check-in report based on journal Markdown;
- tests for the brain tooling.

It does not yet automate the workflow. You still run the commands yourself.

## repository map

```text
janus/
├── AGENTS.md
├── README.md
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
│           ├── vision.md
│           ├── decisions/
│           └── sketches/
├── templates/
│   └── journal.md
├── data/
│   └── brain-index.json
└── tools/
    └── brain/
```

## daily workflow

Start the day by opening or creating today's journal note:

```text
journal/YYYY-MM-DD.md
```

The journal template contains:

```md
## Todo

- [ ]

## Notes

## Check-in

- wellbeing:
```

Use `## Todo` for the day's task list. Use `## Notes` for loose capture. Use root inbox notes only when a thought deserves its own file.

At the end of the day, manually carry forward only tasks that still matter. Janus v0.1 does not roll tasks over automatically.

## commands

Install dependencies:

```sh
pnpm install
```

List root inbox notes:

```sh
pnpm brain:inbox
pnpm brain:inbox -- --json
```

Build the generated index:

```sh
pnpm brain:index
pnpm brain:index -- --json
```

Report wellbeing check-ins from journal Markdown:

```sh
pnpm brain:checkin
pnpm brain:checkin -- --days 7
pnpm brain:checkin -- --days 30
pnpm brain:checkin -- --to 2026-06-25
pnpm brain:checkin -- --json --to 2026-06-25
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

`brain:inbox` inspects direct root Markdown files only. It excludes protected root files and journals.

`brain:index` scans protected root Markdown files, root inbox notes, direct journal files, and `brain/**/*.md`. It writes `data/brain-index.json` with deterministic ordering and schema version 2.

`brain:checkin` reads journal Markdown directly. It does not read or trust `data/brain-index.json`, because the index may be stale or absent.

The check-in command currently supports one metric:

```text
wellbeing: 1-5
```

This is a subjective daily score. Janus reports recorded values, coverage, average, minimum, and maximum. It does not diagnose, predict, classify, or prescribe anything.

## source of truth

When two pieces of information disagree, use this order:

1. Source code and repository-local documentation.
2. Promoted Janus wiki notes under `brain/`.
3. Journal notes under `journal/` as chronological records.
4. Root inbox notes.
5. Generated indexes and summaries.

Root inbox notes and journal notes can be rough. Durable claims should move into `brain/` after they are checked.

## future agent workflow

Right now, Janus relies on manual commands. I run inbox checks, rebuild the index, and ask for check-in reports when I need them.

The next version should make this feel less manual. An agent working inside Janus should be able to:

- inspect the inbox at the start of a session;
- refresh the index when Markdown changes;
- read today's journal before starting work;
- surface unfinished tasks and project follow-ups;
- report wellbeing check-ins when asked;
- choose the right project instructions before acting;
- promote durable knowledge into `brain/` with links back to the project page.

That agent is Janus in the fuller sense: an orchestrator that keeps my engineering context warm across sessions, backed by small scripts when scripts are enough.

## non-goals for now

Janus is not trying to be a database, a dashboard, a notification system, or a full task manager.

v0.1 intentionally avoids automatic task rollover, global task aggregation, reminders, graphs, embeddings, semantic search, and Obsidian plugin code. Those may become useful later, but the current system stays boring: Markdown first, small commands, clear rules.
