---
name: tasks
description: "Whenever the user says something like: 'Begin task: <task name>' - always read this skill to understand how to proceed."
---

# Tasks

Tasks live in `.agents/tasks/<task name>/`; create the folder if missing. `<task name>` is supplied by the user (`Begin task: update-pull-request-workflow` → `update-pull-request-workflow`).

## Artifacts

Inside the task folder are these possible files:

- `TASK.md` - the canonical task contract. It owns the requested outcome, why, acceptance criteria, scope, non-goals, supplied constraints, and unresolved intake questions. Changing outcome, scope, or acceptance requires affirmative task-owner agreement recorded here first. It is read-only during research, planning, review, and implementation. To create or refresh it, read `references/task-creation.md`.
- `CURRENT_DESIGN.md` - the task-relevant, source-verified description of how the system works today: affected files and symbols, consumers, tests, constraints, and blast radius. It is written during research according to `references/research.md`.
- `TARGET_DESIGN.md` - the accepted desired-state contract for tasks with owner-consequential choices. It records accepted decisions and resulting contracts, is read-only once accepted, and is omitted on the fast path.
- `PLAN.md` - the implementation-ready technical plan for realizing the accepted target. It owns reversible implementation decisions, coherent change slices, dependencies, edge and failure behavior, and verification design according to `references/planning.md`. For delegated commit-aligned execution, it also owns the accepted slice metadata produced through that reference's transient execution-map gate. It carries no execution status.
- `TODOs.md` - a non-hierarchical numbered outline of sequential implementation steps derived from `PLAN.md`. It owns execution progress, and each item corresponds to one `STEP-<N>.md`.
- `STEP-<N>.md` - the execution record for TODO N. It owns status, numbered subtasks, working-memory notes, verification evidence, and the exact resume point after interruption.
- `KNOWLEDGE.md` - concise persistent gotchas and dos/don'ts that later TODOs may depend on. Read it at every session start when present; keep it cumulative and prefix future-step discoveries with the TODO they affect.
- `REVIEW.md` - when a task runs under delegated commit-aligned execution (see below), a local ignored, free-form, append-only numbered-round ledger that identifies the currently approved round. It requires no commit hashes, patch checksums, file manifests, or rigid status vocabulary.

These form one order: task contract → current state → accepted target when needed → plan → execution. `TASK.md` and `TARGET_DESIGN.md` are accepted upstream contracts; never silently reinterpret or supersede them.

Execution-file shape:

```md
# TODOs.md
1. [x] Analyze existing user-creation code
2. [ ] Make new users join #general
```

```md
# STEP-2.md — Make new users join #general
Status: IN_PROGRESS

## Sub tasks
1. [x] Locate creation path
2. [ ] Add channel join

## NOTES
<working memory, evidence, and exactly where to resume>
```

## Flow gates

Research establishes what is true; the task owner affirmatively decides owner-consequential parts of what should be true; planning decides the reversible implementation approach. Advance only through these gates:

1. **Intake before research.** `TASK.md` must exist and be current. Do not start research while the outcome or supplied constraints are too unclear to investigate.
2. **Research before target or plan.** Produce or refresh `CURRENT_DESIGN.md` and surface potential target decisions per `references/research.md`. Do not choose a target or plan during research.
3. **Owner-consequential decisions before planning.** A choice is owner-consequential when it changes `TASK.md`'s outcome or acceptance, public or cross-boundary contracts, security posture, migration meaning, concurrency or persisted-state semantics, or another expensive-to-reverse commitment. Each such choice needs affirmative task-owner acceptance recorded in `TARGET_DESIGN.md`; never treat silence as consent. If none exist, omit `TARGET_DESIGN.md` and record the one-line target plus the evidence-based fast-path reason at the top of `PLAN.md`. If a consequential choice appears later, revoke the fast path and return to this gate.
4. **Plan before execution.** After the gates are satisfied, create `PLAN.md`, then derive `TODOs.md`, per `references/planning.md`. When the task will use delegated commit-aligned execution, first complete and accept that reference's transient execution-map gate; ordinary non-delegated planning is unchanged.

## Review

Plan review checks task-contract satisfaction, target fidelity, source grounding, proportionality, completeness, and verification against `references/planning.md`. A task-intent finding reopens `TASK.md`; a research defect reopens `CURRENT_DESIGN.md`; a target-design finding reopens `TARGET_DESIGN.md`; a plan defect returns to planning.

If the user says “review only,” “verify only,” or “verify plan,” complete no TODOs. Review existing artifacts against the planning review contract and current source, then report. Independent reviewers remain read-only.

Ordinary completion is not gated on independent review: after completing a step, stop for user review unless told to continue.

## Execution

Before the first TODO, read `TASK.md`, `TARGET_DESIGN.md` when present, `PLAN.md`, `TODOs.md`, `CURRENT_DESIGN.md`, and `KNOWLEDGE.md` when present. On later TODOs, reload only artifacts relevant to the current step and any contract that constrains it; do not read prior STEP files unless needed.

- Work one TODO at a time. Report briefly after each; leave detail in the STEP `NOTES`.
- Never mark a TODO done until its `STEP-<N>.md` exists, the step is done, its notes are updated, and its `Status` is `COMPLETED`.
- Mark each subtask complete immediately after finishing it so interrupted work resumes cleanly. Only create the current STEP file.
- Record any discovery a later TODO depends on in `KNOWLEDGE.md`, prefixed with the TODO it matters for; old STEP files may never be reread.
- If work reveals that `PLAN.md` or `TODOs.md` must change, update it before proceeding.
- If the harness has a UI todo or checklist tool, do not use it while using this skill.

### Delegated commit-aligned execution

The rules in this subsection apply only when a task runs under **delegated commit-aligned execution**, or when **commit mode is active** for the task. Commit mode is the default only within delegated commit-aligned execution. Ordinary Tasks work — worked directly with no delegation and no commit mode — is unchanged: no `REVIEW.md` is required, no integration review gates completion, no commit step exists, and step closeout remains the completion rule in Execution above.

When these rules apply, **commit mode is on by default**. The task owner may explicitly disable commit creation at any time before Janus creates the commit. Disabling commit mode does not weaken independent review, Janus triage, same-worker correction, the two-round cap, or narrow re-review.

Per-TODO sequence in commit mode:

1. The worker implements and self-verifies without closing the Tasks step.
2. An independent reviewer reviews at the accepted effort — except a remediation TODO that adopts a retained integration reviewer, which instead runs at that reviewer's configured effort; Janus verifies and triages findings, preserving bounded same-worker correction.
3. After approval, Janus stages, creates, and verifies the exact local implementation commit containing only the approved change.
4. Only after commit verification does Janus update ignored local `STEP-<N>.md` and `TODOs.md` and record commit evidence.

Because Tasks artifacts are globally ignored local planning state, those bookkeeping updates require no separate commit, amend, or self-referential commit hash. A commit failure leaves the step incomplete; do not mark the TODO done or set `Status: COMPLETED`. Never push automatically, and never push unless explicitly authorized elsewhere.

In explicit no-commit mode, implementation and independent review proceed unchanged. After approval, Janus closes local Tasks state, records that the task owner disabled commit creation, and preserves a concise reviewed-change surface in `STEP-<N>.md` so later task-wide review stays bounded. Existing commits are never rewritten merely because commit mode later changes.

Janus may reread completed `STEP-<N>.md` records specifically to compile bounded input for task-wide integration review: recorded TODO commits where present, and reviewed change surfaces for no-commit or mixed-mode steps. This is a narrow exception to the ordinary rule that later TODOs need not reload old STEP files; it does not impose a schema on `REVIEW.md`.

## Task-wide integration review

When a task runs under delegated commit-aligned execution, task completion is gated on a fresh High-effort integration review over the task contract, accepted target when present, aggregate task change, cross-step behavior, and end-to-end acceptance evidence — not inferred from completed TODOs alone. This gate does not alter ordinary step closeout semantics for non-delegated Tasks work.

Under delegated commit-aligned execution, `REVIEW.md` preserves numbered internal and external feedback rounds and identifies the currently approved round; new rounds append without erasing prior reasoning.

## Blockers and invalidated targets

- If blocked on something only the user can resolve, add `## PAUSED: user intervention required` to the current STEP with what is blocked, the exact action needed, and alternatives. Stop without marking anything done. After resolution, act on it, relabel the section `## RESOLVED: user intervention`, and continue.
- If evidence shows an accepted target is impossible or unsafe and cannot be preserved by changing only reversible details, stop. During planning or review, report `design decision invalidated` with evidence, impact, and the owner decision needed. During implementation, add `## PAUSED: design decision invalidated` to the STEP and mark nothing done. Update `TARGET_DESIGN.md` only after affirmative acceptance, then re-plan affected work.