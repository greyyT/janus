# Janus v0 Implementation Q&A

This records the implementation decisions locked before building the first Root-Drop Inbox Model slice.

## Context

The repository currently only has the Janus v0 sketch at `brain/projects/janus/sketches/v0.md`. The planned `tools/brain/*.ts`, `package.json`, `brain/` entrypoints, `AGENTS.md`, registry, and `data/` index pipeline do not exist yet.

## Decisions

### 1. Implementation slice

**Question:** What implementation slice should we build first?

**Options considered:**

- Inbox + index slice
- Inbox only
- Full v0 surface

**Decision:** Inbox + index slice.

**Locked scope:** Scaffold the repo enough to run `pnpm brain:inbox` and `pnpm brain:index`; implement root inbox detection, protected-file handling, `location_class` inference, and index output. Do not implement fake `search`, `promote`, `links`, or graph behavior.

### 2. Brain tool runtime

**Question:** What runtime should the brain maintenance scripts use?

**Clarification:** “Brain tools” are small maintenance scripts for the Markdown knowledge base. For this slice, `brain:inbox` lists root Markdown inbox notes, and `brain:index` scans Markdown files and writes a derived index with fields like `location_class`.

**Options considered:**

- `pnpm` + `tsx` TypeScript
- Node JavaScript
- Bun TypeScript

**Decision:** `pnpm` + `tsx` TypeScript.

**Locked scope:** Add `package.json`, `tsx`, and TypeScript scripts under `tools/brain/*.ts`, matching the sketch’s planned layout.

### 3. Generated data policy

**Question:** Should the generated brain index be committed or treated as local derived data?

**Clarification:** `data/` is for generated machine-readable files, not hand-written knowledge. In this slice, `brain:index` writes records for Markdown files so future tools like `brain:search` can read the index instead of rescanning every time.

**Options considered:**

- Local derived data
- Committed index
- Both local and committed

**Decision:** Local derived data.

**Locked scope:** `brain:index` writes `data/brain-index.json`; `data/` is gitignored except `data/.gitignore`.

### 4. Frontmatter support

**Question:** How much Markdown metadata should v0 understand?

**Options considered:**

- Simple flat frontmatter
- No frontmatter parsing
- Full YAML parser

**Decision:** Implement a fault-tolerant flat `frontmatter-lite` parser.

**Locked scope:**

- Frontmatter is recognized only when the first line of the file is exactly `---`.
- The frontmatter block ends at the next line that is exactly `---`.
- Supported entries use one flat `key: value` pair per line.
- Split on the first `:` only, so values may contain colons.
- Keys must match `[A-Za-z][A-Za-z0-9_-]*`.
- Values are strings only; no arrays, nesting, multiline values, YAML anchors, or type coercion.
- Duplicate keys produce a parse warning.
- An unclosed or malformed frontmatter block must not break `brain:inbox` or `brain:index`.
- Malformed frontmatter is reported as a warning and the file remains indexable.

**Rationale:** Root-drop capture must remain forgiving. One malformed note must never prevent the entire knowledge index from being rebuilt.

### 5. Inbox listing scope

**Question:** What should `brain:inbox` report in the first slice?

**Options considered:**

- Exact listing only
- Include link detection
- Include links + duplicates

**Decision:** Exact listing only, with explicit title and age resolution.

**Locked scope:** `brain:inbox` reports:

- relative path;
- title;
- age;
- optional `project`;
- root hygiene count and status;
- parse warning, when applicable.

Title resolution order:

1. frontmatter `title`;
2. first H1 heading;
3. filename converted into a readable fallback title.

Age resolution order:

1. valid frontmatter `created` date, when present;
2. filesystem modification time otherwise.

The CLI must calculate age from an injectable clock in tests rather than directly calling the system clock inside business logic.

Do not implement link detection or duplicate detection yet.

**Rationale:** A predictable title and age contract prevents later search, promotion, and test behavior from diverging.

### 6. Root Markdown matching

**Question:** How strict should root inbox file matching be?

**Options considered:**

- Strict sketch rule
- Case-insensitive Markdown
- Broader Markdown variants

**Decision:** Strict sketch rule with explicit filesystem and path-safety rules.

**Locked scope:**

- Only regular files directly under the repository root are eligible.
- Directories and symlinks are ignored.
- Matching remains case-sensitive and requires the exact `.md` suffix.
- Protected-file exclusion remains exact and case-sensitive.
- Hidden Markdown files such as `.scratch.md` count as inbox notes unless they are protected explicitly.
- All stored index paths use repository-relative POSIX separators, regardless of host operating system.

**Rationale:** This prevents unexpected indexing through symlinks and ensures the generated index is portable between macOS, Linux, and Windows tooling.

### 7. Index scan scope and classification

**Question:** What should `brain:index` scan in v0?

**Options considered:**

- Markdown only
- Markdown + docs folders
- All repo text/code

**Decision:** Markdown only, with exhaustive `location_class` classification.

**Locked scope:** `brain:index` scans only direct root Markdown files and Markdown under `brain/`.

Each indexed document receives exactly one `location_class`:

```text
protected_root
inbox
wiki
archive
```

Classification rules:

```text
root protected Markdown file     → protected_root
root non-protected Markdown file → inbox
brain/archive/**/*.md            → archive
all other brain/**/*.md          → wiki
```

Do not infer note `kind`, `status`, or authority from the file path beyond `location_class`.

**Rationale:** `location_class` is a retrieval and workflow signal. It should be stable, explicit, and independent from future wiki taxonomy.

### 8. Agent rules scope

**Question:** Should this slice create the root knowledge rules file too?

**Options considered:**

- Create root `AGENTS.md`
- Tooling only
- All agent docs

**Decision:** Create root `AGENTS.md`.

**Locked scope:** Add a minimal root `AGENTS.md` from the sketch so future agents know the source-of-truth hierarchy and root inbox rules. Do not create `.claude/rules` or `.agents/skills` yet.

### 9. Test runner

**Question:** How should we verify the new brain tools?

**Options considered:**

- Node test + `tsx`
- Vitest
- No test runner

**Decision:** Vitest.

**Locked scope:** Add Vitest for regression coverage around classification, frontmatter parsing, inbox listing, and index output.

### 10. CLI and index output format

**Question:** What output contract should `brain:inbox` and `brain:index` expose?

**Clarification:** YAML is possible, but the generated index is machine-readable derived data. JSON is stricter and simpler for future tools to consume.

**Options considered:**

- JSON index, human CLI
- YAML index and output
- Both JSON and YAML

**Decision:** JSON index, human CLI.

**Locked scope:** `brain:index` writes `data/brain-index.json`. CLI output remains human-readable by default. `brain:inbox` and `brain:index` both support `--json` from the start for automation.

### 11. Brain home entrypoint

**Question:** Should the slice create a minimal `brain/HOME.md`?

**Options considered:**

- Create minimal HOME
- AGENTS only
- Full wiki skeleton

**Decision:** Create minimal HOME.

**Locked scope:** Add `brain/HOME.md` so `AGENTS.md` points to a real entrypoint. Keep it minimal and do not build the full wiki skeleton yet.

### 12. Root inbox version-control policy

**Question:** Should root-drop inbox notes be ignored, local-only, or tracked by Git?

**Options considered:**

- Ignore root inbox notes by default
- Treat root inbox notes as normal tracked Markdown files
- Support a separate local-only inbox convention

**Decision:** Treat root inbox notes as normal tracked Markdown files.

**Locked scope:**

- Root inbox notes are ordinary repository files and appear in `git status`.
- Do not add a `.gitignore` rule for root `*.md` files.
- `data/` remains local derived output and is ignored except for `data/.gitignore`.
- A future local-only capture mechanism may be added later, but is out of scope for v0.

**Rationale:** Inbox notes are still user-authored knowledge. They should be recoverable, reviewable, and portable across machines. Only generated artifacts should be disposable by default.

### 13. Index output schema and write behavior

**Question:** What guarantees should `data/brain-index.json` provide?

**Decision:** Use a versioned, deterministic JSON index.

**Locked scope:** The index has this top-level shape:

```json
{
  "schema_version": 1,
  "documents": []
}
```

Each document record contains at minimum:

```json
{
  "path": "brain/HOME.md",
  "location_class": "wiki",
  "title": "Janus Brain",
  "frontmatter": {
    "project": "janus"
  },
  "modified_at": "2026-06-24T10:00:00.000Z",
  "frontmatter_warnings": []
}
```

Additional rules:

- Document records are sorted lexicographically by relative path.
- The generated index must not include an unstable build timestamp.
- `brain:index` creates `data/` when it does not exist.
- Index writes use a temporary file followed by rename, so interrupted writes do not leave a partial JSON file.
- The output file is always valid JSON on success.

**Rationale:** Deterministic output makes the index straightforward to test, inspect, diff locally, and consume from future search tooling.

### 14. CLI failure contract

**Question:** When should brain tools fail versus report warnings?

**Decision:** Treat note-level issues as warnings and repository/tooling failures as errors.

**Locked scope:** Warnings do not fail the command:

- malformed frontmatter;
- duplicate frontmatter keys;
- invalid optional `created` values;
- missing title fallback conditions.

Errors fail the command with a non-zero exit code:

- repository root cannot be resolved;
- required paths cannot be read;
- `data/brain-index.json` cannot be written;
- JSON serialization fails;
- an unexpected filesystem error occurs.

`brain:inbox` and `brain:index` should support `--json` from the start, while retaining human-readable output by default.

**Rationale:** Capture should be resilient, but infrastructure failures must be explicit.

### 15. Internal module boundary

**Question:** How should the TypeScript files be organized so later commands reuse the same logic?

**Decision:** Keep CLI entrypoints thin and place reusable logic in internal modules.

**Locked scope:**

```text
tools/brain/
├── inbox.ts
├── index.ts
└── lib/
    ├── filesystem.ts
    ├── frontmatter.ts
    ├── classify.ts
    ├── documents.ts
    └── output.ts
```

- `inbox.ts` and `index.ts` parse arguments, call library functions, and format output.
- Classification and parsing logic must not be duplicated between commands.
- Vitest tests target pure functions first, then a small number of filesystem integration tests.

**Rationale:** Future commands such as `brain:search`, `brain:promote`, and `brain:links` will need the same document discovery and classification behavior.

## Final locked implementation contract

Build the smallest end-to-end v0 slice:

1. Add `pnpm` scripts and TypeScript brain tools using `tsx`.
2. Implement strict root `*.md` inbox detection with exact protected-file exclusions, regular-file-only handling, symlink exclusion, hidden-file inclusion, and POSIX relative index paths.
3. Implement fault-tolerant `frontmatter-lite` parsing with warnings.
4. Implement `brain:inbox` with relative path, title, age, optional project, hygiene status, parse warnings, human output, and `--json`.
5. Implement `brain:index` for Markdown-only indexing into local derived `data/brain-index.json`.
6. Make `data/brain-index.json` versioned, deterministic, sorted by path, timestamp-free at the top level, and written atomically via temp file plus rename.
7. Keep root inbox notes tracked by Git; do not ignore root `*.md`.
8. Keep CLI entrypoints thin and share classification, parsing, document discovery, filesystem, and output logic through internal modules.
9. Add root `AGENTS.md` and minimal `brain/HOME.md`.
10. Add Vitest coverage for pure functions first and targeted filesystem integration behavior.

Out of scope for this slice:

- `brain:search`
- `brain:promote`
- `brain:links`
- graph tooling
- duplicate detection
- backlink/link detection
- source-code indexing
- full wiki skeleton
- `.claude/rules` or `.agents/skills` files
- local-only capture conventions
