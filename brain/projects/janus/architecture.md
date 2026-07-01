# Janus Architecture

## Repository layout

```text
janus/
├── AGENTS.md
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
│           ├── decisions/
│           └── sketches/
├── templates/
│   └── journal.md
├── data/
├── .janus/
│   └── calendar/
└── tools/
    └── brain/
```

## Knowledge model

Janus separates chronological working memory, task commitment, capture, and durable memory:

- `journal/` stores dated daily notes for chronological working memory;
- `backlog.md` stores unresolved, uncommitted tasks and is a protected root file;
- repository-root Markdown files are standalone inbox captures unless protected;
- protected root Markdown files are not inbox notes;
- `brain/` stores promoted durable knowledge;
- `data/` stores generated local indexes.

Markdown remains canonical. Generated data is disposable and lower authority than the Markdown files it describes.

Generated indexes include Markdown document metadata only. Task state, calendar contents, journal todos, checkout reflections, and digest outcomes are not emitted as parsed index records.

## Tooling model

The v0.3 tooling remains intentionally small:

- `pnpm brain:inbox` discovers and reports root inbox notes;
- `pnpm brain:digest:init` creates or resumes `.janus/digest-ledger.md` from the same root inbox queue used by `brain:inbox`;
- `pnpm brain:index` scans Markdown knowledge files and writes `data/brain-index.json`;
- `pnpm brain:calendar` reads the optional local calendar export and reports planning-day availability;
- `pnpm brain:task:add`, `brain:task:list`, `brain:task:move`, `brain:task:checkin`, and `brain:task:checkout` perform deterministic task and journal mutations for slash workflows;
- shared behavior lives under `tools/brain/lib/` so tools reuse discovery, parsing, classification, calendar, task, and queue rules.

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
