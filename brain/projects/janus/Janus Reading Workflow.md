---
title: Reading Workflow
created: 2026-07-22
updated: 2026-10-07
kind: system
---

# Reading Workflow

Janus supports a curated bookshelf and deliberately selected reading plans without treating every book as an obligation or every session as a task.

```text
candidate → managed plan → agreed checkpoint → protected blocks → reported evidence → review
                                                               ↘ postponement → explicit decision
reading scope complete → synthesis pending → learning closeout → plan complete
```

The naturally triggered `.agents/skills/book/SKILL.md` owns capture/recommendation, activation, commitment/scheduling, daily verification, postponement, review/replanning, pause/resume and closeout. No book command or weekly journal is required. This page owns the record contract; [[brain/projects/janus/decisions/Janus Reading System Decision|Reading System Rationale]] preserves the reasons and history.

## Ownership

- [[brain/Reading|Reading]] owns the lightweight candidate catalog and managed-book links, not live execution state.
- A managed book owns identity, lifecycle, target, finish definition, canonical position, provisional roadmap, learning contract, reading/closeout commitment, sourced history, synthesis and material Decisions.
- The calendar owns scheduled time; book block references are contextual, not a second schedule.
- Tickets own substantial application/design work, not routine reading sessions. Goal records own durable direction, not a parallel book plan.
- Daily journals remain passive: decisions no managed book/ticket owns and brief material references. No daily prescription or mandatory session form lives there.
- Weekly planning/review happens conversationally. Historical weekly records remain evidence, not a prerequisite or a competing live commitment store.

## Candidate and managed bookshelf

A candidate creates no managed note, deadline, goal, task, commitment or occupied slot. Keep title, known/supplied author, topic/type, availability (`owned` or `interested`), and optional reason. Search duplicates/alternate editions before capture. A sourced identity/TOC preview may be rich while the persisted catalog stays lightweight.

Identity/edition/contents lookup uses `brain:book:lookup` under the `commands.md` contract and applicable live-call authority. Resolve ambiguity explicitly; retain source/completeness warnings, never invent chapters. User-supplied metadata may be recorded as such rather than requiring external research for every candidate.

A book becomes managed when it receives a selected plan, deserves a completed-book reflection, or needs retained learning/context. Remove duplicate candidate rows and link one canonical managed note:

```text
brain/reading/<Title> — <Author>.md
```

Omit the author from the filename if genuinely unknown. Books are not automatically canonical `G-NNN` goals. One primary goal relationship is allowed when real.

Fiction is recreational by default. Catalog/reflections require explicit request; deadline planning requires an explicit change to that boundary. Candidates and recreational reading never accrue postponement counts.

## Managed-book contract

```md
---
title: Book Title
author: Author Name
kind: book
book_type: technical
availability: owned
reading_status: reading
plan_status: active
created: YYYY-MM-DD
reading_target: YYYY-MM-DD
target_kind: aspirational
progress_unit: section
current_position: "Chapter 1 → Section name"
goal: G-001
---

# Book Title

## Why this book now
...

## Finish definition
**Included:** ...
**Excluded:** ...
**Reading target:** YYYY-MM-DD (hard or aspirational)
**Capacity:** realistic allocation and what it competes with

## Contents
Sourced contents tree, with source and completeness; omit if unavailable.

## Learning contract
- Three to five ideas worth remembering.
- What changed or became clearer.
- One application, experiment or unresolved question.
- Stronger book-specific evidence only when explicitly agreed.

## Plan
### Trajectory
Current position → provisional content checkpoints → reading complete → learning closeout

### Provisional checkpoints
- Content boundaries justified by scope, capacity and observed pace; not commitments.

## Current understanding
- Health: on_track — evidence-backed explanation
- Last reviewed: YYYY-MM-DD
- Current position: same as frontmatter
- Latest evidence: sourced progress/result or unknown
- Main risk: ...

## Reading commitment
...

## Reading history
...

## Learning notes

## Closeout

## Decisions
- YYYY-MM-DD: Decision and reason.
```

Optional fields are omitted rather than blank. A managed book without a deadline-bearing plan can use `plan_status: none` and omit plan-only fields. A deadline-bearing activation establishes an honest target and distinguishes hard from aspirational; it does not invent a target or pace. Prefer named sections, chapters, stable pages, ebook locations, then percentage.

### Lifecycle and slots

`reading_status`: `unread`, `reading`, `paused`, `read`, `dropped`.

`plan_status`: `none`, `active`, `paused`, `synthesis_pending`, `completed`, `abandoned`.

Health is separate: `on_track`, `at_risk`, `blocked`. Paused and closed plans need no current progress health.

Only `active` and `synthesis_pending` occupy one of the three slots. Do not activate/resume a fourth. Pause preserves reason/date, reconsideration trigger, phase, progress and history while freeing a slot; preserve `reading_status: read` when only synthesis remains, otherwise use `paused`. Resume requires a slot/value/capacity decision and returns to the actual phase (`active` or `synthesis_pending`), not an assumed reading restart.

## Commitment contract

Each book has at most one current routine-reading or closeout commitment. `## Reading history` is append-only; retain the disposition and evidence of an old commitment before replacing its live section. A substantial application can have a separately managed ticket without making daily reading a ticket queue.

```md
## Reading commitment

- Commitment: C1 — agreed YYYY-MM-DD
- Phase: reading | closeout
- Status: open | fulfilled | superseded | paused
- Promised output: content checkpoint or bounded learning-closeout result
- Evidence required: ending position or pre-agreed learning evidence
- First action: ...
- Displaces: named optional activity or agreed capacity source
- Review: YYYY-MM-DD or explicit event
- Eligible postponements: 0 — derived from distinct confirmed outcomes in Reading history
- Blocks:
  - C1-B1: YYYY-MM-DD HH:MM–HH:MM Asia/Saigon; stop: ...; calendar status: proposed | confirmed; reference: ...; result: pending | unknown | fulfilled | postponed | excused
- Latest result/evidence: ...
```

Use monotonically allocated local labels (`C1`, `C2`; `C1-B1`, `C1-B2`) and the owner file path to identify an agreement uniquely. Include the actual timezone and confirmed placement/source when available. If scheduling cannot be resolved yet, retain an explicitly agreed dated/event-based decision point and unresolved blocks honestly. Proposed times are not calendar events.

If an existing goal-ticket agreement already covers the same output/blocks, the book may instead retain only:

```md
## Reading commitment

- Authoritative agreement: [[tickets/J-NNN-slug#Goal commitment|Shared agreement]]
- Relationship: how this reading serves the same explicitly agreed output
```

The link owner is the only source for blocks, results and counters. Conversely, a goal ticket can point to a book-owned routine-reading agreement instead of duplicating it. Ordinary reading belongs to the book; substantial application belongs to the ticket. Do not migrate historical agreements without approval. Resolve owner links before verification, report/escalate a shared agreement once, and never add duplicate counts.

Examples of append-only material evidence:

```md
- YYYY-MM-DD: Commitment C1 agreed: <output>; blocks <labels>; displaces <activity>; review <point>.
- YYYY-MM-DD: C1-B1 fulfilled through its agreed stop; ending position <...>; source <user report>; commitment output <met/not yet met>.
- YYYY-MM-DD: C1-B2 postponed; original block <time>; reason/source <...>; eligible yes; count 1/3; replacement <approved block or unresolved decision>.
- YYYY-MM-DD: C1-B3 excused; reason/source <...>; eligible no; count remains 1/3; approved replan <...>.
- YYYY-MM-DD: Commitment C1 fulfilled: <evidence>; next decision <...>.
```

Minutes and learning points are optional unless pre-agreed. There is no compulsory entry for every section or daily report. User decisions use the decisions skill's `Decision (user):` format in the managed book's Decisions, or the shared ticket work log when it owns the agreement.

## Operating rules

### Activate and agree work

Resolve why now, edition, scope, baseline, target semantics, capacity, learning contract and optional goal relationship. Curiosity is valid, but time/slots remain scarce. Preview the note, candidate-row removal and hub link; rescan slots/path before applying approval.

Build future content checkpoints only from honest constraints, leaving buffer when possible; initial reading calibrates unknown pace. Activation resolves the first explicit commitment or an agreed point to choose it. An active plan or provisional checkpoint is not an agreement. Weekly planning can happen in normal conversation, without a weekly note.

Every agreement specifies output/evidence, realistic blocks, first action, time-limited stops, displaced activity and review. Zero-book days are valid, one managed book per day is the default, and two require an explicit reason. Include reading in the same capacity assessment as goals, employment, sleep, exercise and recovery. A goal link grants no automatic allocation.

Schedule fixed-time blocks only through an approved authorized action or user-confirmed manual placement. No plan approval implicitly authorizes calendar writes, external invitations or lookup calls.

### Verify and record

Daily check-in, after its Dream gate, reads active/synthesis-pending books and outstanding agreements, including shared-owner links. Verify elapsed blocks against real evidence. Missing records are unknown; ask one focused result question rather than inventing postponement or zero progress. Each check-in also considers whether reading fits today's actual capacity/priorities: confirm an agreed block, or propose one specific book/closeout with time box/block, content aim, stop and displaced activity. A proposal becomes today's allocation/commitment only when the user agrees; no weekly journal or previously scheduled block is required. Do not silently change a broader checkpoint, target or budget. Zero-reading days are valid.

On reported progress, immediately update frontmatter position and Current understanding consistently, with a sourced Reading history entry and optional learning. No second approval for the factual ending position. Lifecycle, target, scope, health, learning-contract and commitment changes still require approval. Do not invent exact minutes, comprehension or completion.

Honor the agreed stop. A session that took place but did not reach its content aim is pace evidence, not automatically a missed block. Partial progress neither erases old misses nor falsely completes the whole output.

### Postponement and accountability

Each distinct confirmed missed/deferred agreed block counts once toward the same unfulfilled output. Moving one block repeatedly before it occurs is one block; separate agreed replacement blocks can each qualify. Retain original time, reason/source, eligibility and the resulting decision. Unknowns are not strikes.

Illness, genuine urgent obligations and necessary recovery are excused: preserve the displacement record, exclude it from the count, and replan. Rescheduling does not reset the counter. Fulfilled outputs close their commitment; approved scope changes, pauses and abandonment preserve prior history/disposition.

At three eligible postponements, read and apply [[brain/Precedents|Harsh accountability after three goal or reading postponements (P-001)]]. It applies to explicitly agreed reading and learning-closeout commitments whether or not linked to a goal. Use harsh, performed anger, concrete consequences and a challenge to whether the plan deserves active status; require concrete action or explicit replanning. Goal/plan changes remain the user's decision. No insults, coercion, fabricated certainty or claimed actual assistant feelings. Respect conscious decisions without repetitive scolding absent new evidence. Judge effectiveness by subsequent action.

Do not retroactively count stale weekly allocations, old targets, or absent session evidence as strikes. This is a conversational procedure, not background surveillance.

### Review and close

Review weekly or when evidence/constraints change: actual position, demonstrated learning, pace, target, capacity, outstanding agreements and continued value. Recommend one direction. Target/scope conflicts require an explicit choice among bounded catch-up, reduced scope, revised target, accepted risk, pause or abandonment—not hidden extra time. A book must not displace the independent skill evidence its supporting goal needs.

Preview material plan/lifecycle changes and append approved Decisions. Preserve historical targets and reasoning; no silent extension. Pausing frees the slot without claiming success; resuming reviews old targets and agrees realistic work rather than reusing stale allocations automatically.

When agreed reading scope is confirmed complete, record the position and preview `reading_status: read`, `plan_status: synthesis_pending`, actual `reading_completed` and `closeout_due` seven days later. Approve the lifecycle transition and establish a bounded closeout agreement separately; the due date alone is not a scheduled block.

Completion requires the agreed learning contract: default three to five ideas, what changed/became clearer, one application/experiment/unresolved question, and any stronger pre-agreed technical evidence. Preview and approve `plan_status: completed`, `closed`, closeout evidence and hub change. Report reading and learning completion separately. Promote book claims only when independently verified.

Abandonment records date, reason, actual progress, useful learning and explicit linked-work disposition; use `reading_status: read` if already read, otherwise `dropped`. Keep the managed note at its stable path, and never silently drop a related goal or application ticket.

## Workflow history

- 2026-07-22: Original reading system established the curated candidate/managed tiers, three-slot ceiling, selective deadlines, content-paced plans and separate synthesis closeout.
- 2026-08-26: Event-time progress replaced daily checkout. Historical checkout/CLI details remain in the implementation specification, not current operating instructions.
- 2026-10-07: Greyy approved a naturally triggered book skill, book-owned output/block commitments, conversational weekly planning, daily check-in verification, immediate factual position updates without a second approval, explicit paused lifecycle, and extension of P-001 to all explicit managed-reading/closeout commitments. Candidates and recreational reading remain excluded. Shared goal/reading agreements have one owner/counter. Existing book targets, progress, lifecycle and commitments are not migrated automatically.
