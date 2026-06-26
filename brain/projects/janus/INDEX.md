# Janus

Janus is a Markdown-first personal engineering knowledge system.

## Project pages

- [Vision](vision.md)
- [Architecture](architecture.md)
- [Journal Workflow](journal-workflow.md)
- [Digest Workflow](digest-workflow.md)
- [Decisions](decisions/INDEX.md)

## Current implementation

The v0.2 slice adds a harness-native inbox digest workflow while preserving the v0.1 journal and root inbox model:

- `journal/YYYY-MM-DD.md` files are chronological daily working memory;
- root Markdown files are standalone inbox captures unless they are protected root files;
- `brain/` contains promoted durable wiki knowledge;
- `brain:inbox` lists current root inbox notes and excludes journals;
- `brain:digest:init` creates or resumes the local `.janus/digest-ledger.md` checklist for `/digest`;
- `.claude/commands/digest.md` defines the interactive `/digest` workflow;
- `brain:index` writes the local derived schema-v2 index at `data/brain-index.json`;
- `brain:checkin` reports wellbeing scores directly from journal Markdown.

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
