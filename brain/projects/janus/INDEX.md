# Janus

Janus is a Markdown-first personal engineering knowledge system.

## Project pages

- [Vision](vision.md)
- [Architecture](architecture.md)
- [Decisions](decisions/INDEX.md)

## Current implementation

The v0 slice implements the Root-Drop Inbox Model:

- root Markdown files are capture inbox notes unless they are protected root files;
- `brain/` contains promoted durable wiki knowledge;
- `brain:inbox` lists current root inbox notes;
- `brain:index` writes the local derived index at `data/brain-index.json`.

## Sketches

- [Root-Drop Inbox Model](sketches/v0.md)
- [Implementation Q&A](sketches/v0-qna.md)
- [Implementation Plan](sketches/v0-plan.md)
