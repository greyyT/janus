# Janus

Janus is a Markdown-first personal engineering knowledge system.

## Project pages

- [Vision](vision.md)
- [Architecture](architecture.md)
- [Journal Workflow](journal-workflow.md)
- [Digest Workflow](digest-workflow.md)
- [Daily Planning Workflow](daily-workflow.md)
- [Decisions](decisions/INDEX.md)

## Current implementation

The v0.3 slice adds a Markdown-native daily planning loop while preserving the journal, root inbox, and durable brain model:

- `journal/YYYY-MM-DD.md` files are chronological daily working memory with check-in, todo, notes, and checkout sections;
- `backlog.md` is a protected root Markdown file and the queue of unresolved, uncommitted tasks;
- root Markdown files are standalone inbox captures unless they are protected root files;
- `brain/` contains promoted durable wiki knowledge;
- `brain:inbox` lists current root inbox notes and excludes protected root files, journals, and backlog;
- `brain:digest:init` creates or resumes the local `.janus/digest-ledger.md` checklist for `/digest`;
- `.claude/commands/digest.md` defines the interactive `/digest` workflow;
- `.claude/commands/add-task.md`, `.claude/commands/checkin.md`, and `.claude/commands/checkout.md` define the daily task workflows;
- `brain:index` writes the local derived schema-v2 index at `data/brain-index.json`;
- `brain:task:*` scripts perform deterministic task movement and reflection writes;
- `brain:calendar` reads the optional local `.janus/calendar/primary.ics` export for planning.

## TODO

- Improve `/digest` so the teaching phase is visibly interactive and consistently uses harness-native tools instead of shell fallbacks.

## Sketches

- [Root-Drop Inbox Model](sketches/v0.md)
- [Implementation Q&A](sketches/v0-qna.md)
- [Implementation Plan](sketches/v0-plan.md)
- [Journal-First Daily Capture and Wellbeing Tracking](sketches/v0.1.md)
- [v0.1 Implementation Plan](sketches/v0.1-plan.md)
- [Harness-Native Inbox Digest](sketches/v0.2.md)
- [v0.2 Implementation Plan](sketches/v0.2-plan.md)
- [Daily Planning Loop](sketches/v0.3.md)
- [v0.3 Implementation Plan](sketches/v0.3-plan.md)
