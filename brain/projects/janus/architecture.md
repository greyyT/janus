# Janus Architecture

## Repository layout

```text
janus/
├── AGENTS.md
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
└── tools/
    └── brain/
```

## Knowledge model

Janus separates chronological working memory, capture, and durable memory:

- `journal/` stores dated daily notes for chronological working memory;
- repository-root Markdown files are standalone inbox captures;
- protected root Markdown files are not inbox notes;
- `brain/` stores promoted durable knowledge;
- `data/` stores generated local indexes.

Markdown remains canonical. Generated data is disposable and lower authority than the Markdown files it describes.

## Tooling model

The v0.2 tooling remains intentionally small:

- `pnpm brain:inbox` discovers and reports root inbox notes;
- `pnpm brain:digest:init` creates or resumes `.janus/digest-ledger.md` from the same root inbox queue used by `brain:inbox`;
- `pnpm brain:index` scans Markdown knowledge files and writes `data/brain-index.json`;
- `pnpm brain:checkin` reads journal Markdown directly and reports wellbeing check-ins;
- shared behavior lives under `tools/brain/lib/` so tools reuse discovery, parsing, classification, and queue rules.

`brain:checkin` does not read, require, or trust `data/brain-index.json`. Journal Markdown remains canonical when the generated index is stale or absent.

## Index classes

Each indexed Markdown document receives exactly one location class:

```text
protected_root
journal
inbox
wiki
archive
```

Classification is path-derived and does not infer future taxonomy such as kind, status, or authority.

Rules:

```text
exact protected root Markdown file       -> protected_root
direct regular Markdown file in journal/ -> journal
direct non-protected root Markdown file  -> inbox
brain/archive/**/*.md                    -> archive
all other brain/**/*.md                  -> wiki
all other paths                          -> ignored
```

## Journal files

Only direct Markdown files under `journal/` are journal documents.

Valid dated journals use:

```text
journal/YYYY-MM-DD.md
```

Nested journal files are ignored. Invalid direct journal filenames are still indexed as `journal` documents with warnings, but they do not participate in check-in date windows.
