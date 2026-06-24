# Janus Architecture

## Repository layout

```text
janus/
├── AGENTS.md
├── brain/
│   ├── HOME.md
│   └── projects/
│       └── janus/
│           ├── INDEX.md
│           ├── architecture.md
│           ├── vision.md
│           ├── decisions/
│           └── sketches/
├── data/
└── tools/
    └── brain/
```

## Knowledge model

Janus separates capture from durable memory:

- repository-root Markdown files are inbox notes;
- protected root Markdown files are not inbox notes;
- `brain/` stores promoted durable knowledge;
- `data/` stores generated local indexes.

## Tooling model

The v0 tooling is intentionally small:

- `pnpm brain:inbox` discovers and reports root inbox notes;
- `pnpm brain:index` scans Markdown knowledge files and writes `data/brain-index.json`;
- shared behavior lives under `tools/brain/lib/` so future tools can reuse the same discovery, parsing, and classification rules.

## Index classes

Each indexed Markdown document receives exactly one location class:

```text
protected_root
inbox
wiki
archive
```

Classification is path-derived and does not infer future taxonomy such as kind, status, or authority.
