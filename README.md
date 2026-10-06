# Janus

Janus is my Markdown-first engineering OS.

This repo is meant to be the first place an agent opens at the start of a working session. The agent spawned here should act as the orchestrator for the rest of the work: read the current state, recover prior decisions, understand what I was doing last time, and decide which project-specific instructions apply before touching code elsewhere.

It is also my second brain. I want to be able to dump rough notes, links, decisions, project ideas, daily context, and unfinished thoughts without spending time classifying everything up front. Some knowledge will overlap. That is fine. Janus handles overlap through location rules, source-of-truth rules, and project-specific instructions rather than forcing every note into a perfect taxonomy on day one.

The long-term goal is simple: when I start a session, Janus should already know where to look, what matters, what is still rough, and what rules the agent should follow for the project in front of it.

## what Janus is for

Janus keeps its Markdown memory in separate places, each with one job.

Managed work lives in `tickets/`: `tickets/BOARD.md` is the canonical state, and each `J-NNN` ticket file carries its outcome, current checkpoint, acceptance evidence, and work log. See `docs/ticket.md`.

Projects live under `brain/projects/`. A project page holds what Janus currently believes about an initiative or a repository; tickets feed it. See `docs/project.md`.

Decisions and authority are kept apart. My decisions are logged as they happen; reusable ones become precedents in `brain/Precedents.md` once I approve them; permissions for protected actions such as pushes, merges, and deploys are grants in `brain/Grants.md` or on the ticket. See `docs/decisions.md`.

`journal/` is a passive daily record: the dispatch, material changes, ticket-session references, decisions no ticket owns, and rough notes. It is not a todo list or a reminder surface.

Root Markdown files are inbox captures. These are standalone thoughts that deserve their own title, source context, or likely promotion path. They can be incomplete or wrong. They are allowed to be messy.

`brain/` is durable knowledge. Notes in `brain/` should be maintained, linked from the right project page or wiki page, and treated as more deliberate than root inbox notes.

Markdown remains the source of truth.

## the vision

I do not want Janus to become a dashboard or a task app. I want it to become the operating layer around my engineering work.

In practice, that means:

- every agent session starts from this repo;
- Janus knows the current work, prior decisions, and active project context;
- Janus coordinates repository work through coordinators and asks me only when my judgment or authority is actually needed;
- project pages explain how an agent should behave for that project;
- rough notes become usable without requiring manual organization first;
- durable knowledge gets promoted into `brain/` when it earns that status;
- generated indexes help agents navigate, but never replace the Markdown.

The important part is the boundary. I should be able to drop anything into Janus quickly, then rely on agents and repo rules to sort out how that information should be interpreted later.

## how a session works

There are no daily rituals to remember. Janus recognizes what the conversation needs through its skills in `.agents/skills/`:

- `tickets` captures, starts, checkpoints, and replans managed work;
- `projects` creates, updates, reviews, and closes projects from ticket evidence;
- `decisions` records my decisions, proposes precedents, and maintains grants;
- `dream` runs overnight only, through `tools/dream/dream.sh`.

Each active ticket says whether it needs me: `autonomous` while an agent drives it, `human_required` while it waits on my decision, review, or hands-on work. At most two tickets need my attention at once; autonomous work is not limited.

## dream

Every night at 03:00, Dream reads the day back: my Janus conversations, my root notes, and everything Janus changed. It brings tickets, projects, decisions, precedents, grants, and `brain/Working Model.md` (how I actually work) up to date, digests every root note, and opens one pull request whose description explains every change and its evidence. Merging is my approval. If the Mac was off or offline, Dream catches up before my next prompt. See `docs/dream.md`.

Install the nightly job once per machine with `pnpm dream:install`.

## coordinate mode

Run `/coordinate` in a Janus pi session inside a Herdr pane to turn on coordinate mode for the rest of the session. Janus then hands repository work to coordinators: each one is a pi agent in `coordinator/` that drives one request in one repository to a verified result through worker agents. See `coordinator/README.md`.

I talk only to Janus. Coordinators report back on their own; Janus checks each result against its precedents, project direction, and grants, answers what it can, and brings me only what needs my judgment or authority. Coordinators never see tickets, and each request carries only the permissions Janus resolved for it.

Coordinate mode needs `pi` and `herdr` on `PATH`.

## repository map

```text
janus/
├── AGENTS.md               # locations, authority, and rules agents follow
├── README.md
├── commands.md             # reference for package.json scripts
├── docs/                   # how tickets, projects, decisions, and Dream work
├── .agents/skills/         # tickets, projects, decisions, dream
├── .pi/extensions/         # /coordinate mode and the Dream catch-up
├── coordinator/            # the coordinator Janus spawns per request
├── brain/
│   ├── HOME.md
│   ├── Precedents.md
│   ├── Grants.md
│   ├── Working Model.md
│   └── projects/
├── tickets/                # BOARD.md and J-NNN files, created by the first capture
├── journal/
├── templates/
│   └── journal.md
└── tools/
    ├── brain/              # calendar and session-transcript scripts
    └── dream/              # the nightly Dream runner and its launchd installer
```

The journal template contains:

```md
## Dispatch

## Changes

## Notes

### Ticket sessions
```

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

List the day's Janus conversation transcripts, excluding coordinator sessions, and read one:

```sh
pnpm brain:sessions -- --date YYYY-MM-DD --json
pnpm brain:transcript -- <path>
```

Run tests:

```sh
pnpm test
```

Type-check the tooling:

```sh
pnpm exec tsc --noEmit
```

`brain:calendar:add` stores read-only iCalendar feed links in gitignored `.janus/calendar/config.json`. `brain:calendar` live-fetches configured feeds and returns calendar-labeled events and merged busy blocks for the day, falling back to legacy `.janus/calendar/primary.ics` only when no feed list is configured. Missing or unreachable calendar input produces an unavailable state or warnings rather than an error.

## source of truth

When two pieces of information disagree, use this order:

1. Source code and repository-local documentation.
2. Promoted Janus wiki notes under `brain/`.
3. Journal notes under `journal/` as chronological records.
4. Root inbox notes.
5. Generated indexes and summaries.

Root inbox notes and journal notes can be rough. Durable claims should move into `brain/` after they are checked.

## non-goals for now

Janus is not trying to be a database, a dashboard, a notification system, or a full task manager.

It intentionally avoids automatic scheduling, priorities, reminders, graphs, embeddings, semantic search, and Obsidian plugin code. The system stays boring: Markdown first, small skills and scripts, clear rules.
