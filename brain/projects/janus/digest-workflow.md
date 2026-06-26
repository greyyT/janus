---
title: Digest Workflow
created: 2026-06-26
kind: system
---

# Digest Workflow

Janus v0.2 adds `/digest`, a harness-native command for processing root inbox Markdown captures into clarified, non-duplicated durable knowledge.

`/digest` is not a new Janus app, search service, background worker, or retrieval system. It is an agent workflow that runs inside the existing coding-agent harness and uses repository reads, shell commands, search, conversation state, and guarded edits.

## Scope

`/digest` processes root inbox notes only.

The authoritative work queue is:

```sh
pnpm brain:inbox -- --json
```

The digest must not process, read for digestion, summarize, or modify:

```text
journal/**
```

Journal reflection and weekly review remain out of scope for v0.2.

## Local digest ledger

The digest uses a local operational checkpoint:

```text
.janus/digest-ledger.md
```

This file is not durable knowledge. It is a checklist that helps long multi-note digests resume safely and gives a future hook one file to inspect.

Initialize or resume it with:

```sh
pnpm brain:digest:init
```

Behavior:

```text
No ledger exists          -> create it
Ledger exists             -> preserve it and report that it is being resumed
Explicit --reset          -> overwrite it
```

Reset command:

```sh
pnpm brain:digest:init -- --reset
```

Resetting discards checklist progress. `/digest` should reset only after explicit user instruction.

The ledger is gitignored with:

```gitignore
/.janus/digest-ledger.md
```

## Checklist format

Initial ledger shape:

```md
# Janus Digest Ledger

- [ ] note-a.md
- [ ] note-b.md
```

During a digest, valid outcome lines are:

```md
- [x] note-a.md — clarified
- [x] note-b.md — parked
- [x] note-c.md — keep raw
- [x] note-d.md — proposed discard
```

`[x]` means no further teacher/retrieval work is required for this digest run. It does not mean a final changeset was approved or applied.

`proposed discard` remains unapproved until the final approval gate.

## Startup staleness check

At startup, `/digest` must compare paths from:

```sh
pnpm brain:inbox -- --json
```

against paths in:

```text
.janus/digest-ledger.md
```

Interpretation:

```text
Exact match       -> resume
Mismatch          -> explain added/removed paths and ask whether to reset
```

The agent must never silently reconcile a stale ledger or discard prior checklist state.

## Pre-approval write boundary

Before the user approves a complete changeset, the agent may modify only:

```text
.janus/digest-ledger.md
```

Before approval, it must not modify:

```text
inbox notes
journal notes
brain notes
archive notes
templates
source code
project documentation
```

Knowledge-source edits happen only after explicit approval.

## Interaction protocol

`/digest` should use the harness `ask` tool for user input instead of plain chat questions.

Required `ask` uses:

```text
teacher questions
stale-ledger reset decisions
organization ambiguity decisions
archive destination collision decisions
final changeset approval
```

Each `ask` question should name the concrete note or file path, the evidence or ambiguity that creates the question, and a recommended option when one is safe.

For open-ended teacher extraction, the agent should ask one targeted question and provide concise options when useful. If fixed options do not fully cover the answer, the user can answer through the tool's custom input path.

The command should not use shell `grep`, `find`, `ls`, or pipelines for digest retrieval or inventory. It should use harness-native search, file listing, and read tools.

## Teacher loop

The teacher loop is mandatory for every unresolved inbox note. `/digest` should not skip directly from inventory to organization.

At the start of this phase, the agent should print:

```text
Phase 2 — Teaching: <path>
```

For each active note, `/digest` should:

1. Read the current source note in full.
2. Classify its provisional shape.
3. State a concise interpretation.
4. Search relevant durable notes under `brain/**/*.md` using harness-native search tools.
5. Read full plausible candidate notes.
6. Identify the highest-value missing knowledge.
7. Show a compact teaching card:

   ```text
   Teaching note: <path>
   Provisional shape: <shape>
   Current interpretation: <1-3 bullets>
   Retrieved context: <paths or "none found">
   Highest-value gap: <specific missing knowledge>
   ```

8. Use the harness `ask` tool to ask exactly one targeted question.
9. Stop and wait for the user's answer.
10. Update the conversation ledger after the answer.
11. Re-run retrieval if the answer changes concepts, constraints, evidence, or likely destination.
12. Continue only until a safe disposition is possible.
13. Update `.janus/digest-ledger.md` before moving to another inbox note.

For trivial captures such as a bare link, task, or reminder, the teacher loop still happens. The question should be only the minimum needed to decide whether the note should remain raw, become durable knowledge, or be discarded.

The goal is safe disposition, not complete understanding.

## Retrieval protocol

Retrieval is agentic repository inspection, not a new search feature.

For each non-trivial note, the agent should:

1. Extract likely concepts, proper nouns, project names, and decision terms.
2. Search `brain/**/*.md`.
3. Inspect full contents of plausible candidate notes.
4. Compare claims, scope, and ownership boundaries.
5. Return a small evidence set.

Each retrieval result should include:

```text
path
location class
relevant excerpt
relationship
confidence
```

Allowed relationships:

```text
supports
refines
contradicts
duplicates
contains
historical_context
weakly_related
```

The agent must not claim duplication, contradiction, or mergeability from title or keyword matches alone.

`brain/archive/**` is historical context, not the default edit target.

## Organization proposal

After all active notes are clarified, `/digest` creates a proposal for each note:

```text
Source note:
Extracted knowledge:
Evidence and uncertainty:
Relevant durable notes:
Relationship:
Recommended disposition:
Recommended source handling:
Reasoning:
Proposed destination:
Open decision:
```

Allowed dispositions:

```text
update_existing_note
merge_into_existing_note
create_new_durable_note
keep_in_inbox
park_for_later
discard_with_confirmation
```

Allowed source handling:

```text
preserve_in_root
archive_after_promotion
delete_with_confirmation
```

Default preference:

```text
update or merge before creating a new durable note
```

When placement is materially ambiguous, the agent asks one organization question and stops.

If an inbox note conflicts with durable `brain/` knowledge and the user does not resolve the conflict, default to `park_for_later` and leave the source note in root inbox.

## Archive handling

Approved archived root captures go under:

```text
brain/archive/inbox/
```

If the archive destination already exists, the agent must stop and ask the user for a destination.

The agent must not overwrite or auto-merge archived captures.

## Approval and apply

Before writing knowledge-source files, `/digest` presents one compact changeset:

```text
Create:
Update:
Source handling:
Keep in inbox:
Discard:
```

After explicit approval, the agent must:

1. Re-read every source and target file.
2. Apply only the approved edits.
3. Preserve source captures unless the approved plan explicitly moves, archives, or deletes them.
4. Check archive destination collisions before moving captures into `brain/archive/inbox/`.
5. Run:

   ```sh
   pnpm brain:index
   ```

6. Inspect the final diff.
7. Report changed files, intentionally unchanged files, notes parked or kept raw, and unresolved decisions.

## Verification cases

Manual verification should cover:

```text
a raw idea with missing context
a note that clearly refines an existing durable note
a note with two plausible durable homes
a bare reference or link
a note that should remain in inbox
an inbox note that conflicts with existing knowledge
a journal note that must not appear in the digest queue
a stale digest ledger whose paths differ from the current inbox queue
an archive destination collision
```

For each applicable case, verify:

1. `/digest` uses `brain:inbox` as its queue.
2. `brain:digest:init` creates or resumes the inbox checklist.
3. The agent inventories queued notes before the first teacher question without reading every queued note in full.
4. The agent reads the current full note before asking about it.
5. The agent performs repository retrieval before proposing a destination.
6. Teacher questions are specific, information-seeking, and limited to what is needed for a safe disposition.
7. The agent asks before resolving genuine organizational ambiguity.
8. The agent updates `.janus/digest-ledger.md` before moving to another note.
9. No knowledge-source file changes occur before explicit approval.
10. Archive destination collisions stop for user input instead of overwriting.
11. The post-approval diff matches only the approved changes.
