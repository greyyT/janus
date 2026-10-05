# Implementation-planning contract

Use this reference when creating, revising, or reviewing `PLAN.md` and `TODOs.md` after the Tasks skill's research and target-design gates are satisfied.

## Quality bar

Create an **implementation-ready technical plan**. High-level means the plan is non-executable and does not pre-write finished source; it does not mean vague or underspecified.

The plan is ready when a competent implementer should not need to redesign the solution, but must still implement and verify it.

Plan the smallest coherent solution that fully satisfies the requested outcome and acceptance criteria. Avoid speculative extensibility, unrelated refactors, unnecessary abstractions, premature migrations, and tooling or verification disproportionate to the task. Under-planning and ceremonial over-documentation are both defects.

## Planning inputs and authority

Read canonical `TASK.md`, repository conventions, verified `CURRENT_DESIGN.md`, and accepted `TARGET_DESIGN.md` when the full path was required. On the fast path, use `TASK.md` and the recorded fast-path basis instead of manufacturing `TARGET_DESIGN.md`.

`TASK.md` owns requested outcome, acceptance, scope, non-goals, and supplied constraints. `TARGET_DESIGN.md` owns owner-consequential target decisions within that contract. Treat both as read-only. Do not silently reinterpret, replace, weaken, or supersede them.

`PLAN.md` owns reversible implementation decisions and their rationale: choices about how to realize the accepted target that can be changed without renegotiating observable behavior, public or cross-repository contracts, security posture, migration meaning, persisted-state semantics, or another expensive-to-reverse commitment.

If new evidence shows that the accepted target is impossible, unsafe, or cannot be preserved by changing only reversible implementation details, stop and report that the target design is invalidated. Do not choose a fallback target.

## Transient execution-map gate for delegated commit-aligned execution

This gate applies only when a task will be executed through delegated commit-aligned execution. Ordinary, non-delegated Tasks planning is unchanged and proceeds directly to `PLAN.md` and `TODOs.md` under the rest of this contract.

Before writing canonical `PLAN.md` or `TODOs.md`, the planner retained for the delegated planning run and the coordinator as the delegating orchestrator negotiate a run-specific, inspectable execution map at a named `/tmp` path. For every proposed implementation slice, the map records:

- outcome;
- dependencies;
- verification boundary;
- atomic commit boundary;
- size (`small`, `medium`, or `large`);
- review effort (`minimal`, `medium`, or `high`);
- an evidence-based risk rationale.

Size and review effort are independent. When review effort is uncertain, use `medium`. A `large` slice must state why splitting it would not produce a safer coherent boundary.

The complete negotiation has a flexible budget of three substantive planner turns. A turn may combine questions, a map proposal, and revisions; there is no per-activity quota. Mechanical handoff retries and time spent waiting for an owner decision do not consume turns. The coordinator may accept the map earlier. After the third unresolved substantive turn, the coordinator must accept it, reject it, escalate the unresolved issue to the task owner, or mark planning blocked.

Only after the coordinator accepts the map may the planner write canonical `PLAN.md` and derive `TODOs.md`. `PLAN.md` then owns the accepted slice metadata and implementation argument; the temporary map remains only a plan-review fidelity input and has no canonical authority after `PLAN.md` and `TODOs.md` are approved. Pass the accepted map path to the retained planner and independent plan reviewer, never to an implementation worker. If the map is lost before plan approval, terminate and restart planning; never reconstruct accepted slicing from memory.

## What the plan must settle

Include only what is relevant, but settle every material item the implementation depends on:

- satisfaction of `TASK.md` and fidelity to accepted target behavior;
- acceptance evidence for every required outcome;
- reversible implementation decisions and why they were chosen;
- affected files, symbols, modules, and external boundaries;
- contracts, data flow, state transitions, and dependencies;
- sequencing constraints between coherent implementation slices;
- edge cases, failure behavior, compatibility, migration mechanics, and rollback when applicable;
- verification: tests, commands, manual observations, and expected results;
- assumptions, source claims not yet verified, and unresolved implementation questions;
- explicit scope and non-goals when adjacent work could be mistaken for part of the task.

Ground claims about current behavior in repository source and applicable conventions. Distinguish verified facts, accepted target decisions, proposed implementation choices, assumptions, and unresolved questions. Do not represent planned work as completed.

## Artifact boundaries

### `PLAN.md` — implementation argument

Owns the implementation approach, reversible decisions and rationale, coherent change slices and dependencies, selective implementation-shape sketches, edge and failure behavior, verification design, assumptions, and open implementation questions. It carries no execution status or completion checkboxes.

Cite `TASK.md` for requested outcomes and `TARGET_DESIGN.md` for consequential target choices rather than restating or reopening them. `PLAN.md` may repeat a task, current-state, or target fact only when it is a tight premise that a nearby implementation decision depends on, and it must cite the relevant source artifact. Use this deletion test: if removing the fact leaves the decision understandable and reviewable, remove the repetition and cite instead; if removal makes the implementation choice arbitrary or forces reconstruction mid-argument, keep the premise concise.

On the fast path, begin `PLAN.md` with the one-line target and the recorded reason that no consequential target decision required an owner gate.

### `TODOs.md` and `STEP-<N>.md` — execution

`PLAN.md` defines coherent slices, dependency edges, and why the dependencies exist. `TODOs.md` linearizes those slices into a numbered execution order and owns progress. `STEP-<N>.md` owns per-step subtasks, working memory, implementation discoveries, and verification evidence.

Do not duplicate the plan's rationale in `TODOs.md`, and do not pre-create execution status in `PLAN.md`.

## Implementation-shape sketches

Include an interface, type, schema, signature, or control-flow pseudocode only when a competent implementer could otherwise reasonably choose a materially different structure. Every sketch must resolve a nameable implementation ambiguity.

Typical reasons include:

- a new public interface or module boundary;
- non-obvious control flow or state transition;
- concurrency, ordering, idempotency, or retry behavior;
- security, authentication, authorization, or secret boundaries;
- migration, backfill, or compatibility behavior;
- non-trivial error and failure handling;
- a contract crossing a module, service, or repository boundary.

This list is illustrative, not closed. Label unresolved or speculative shapes explicitly.

Do not sketch mechanical edits, constant or version bumps, renames, unchanged functions, or established local patterns. Cite the affected `file:symbol` and describe the delta instead. Do not create runnable implementation or source scaffolding during planning.

### Useful sketch

A sketch is useful when it fixes an implementation contract and clarifies control flow without supplying finished implementation:

```ts
interface RetryPolicy {
  maxAttempts: number;
  retryable(error: unknown): boolean;
}

async function executeJob(job: Job, policy: RetryPolicy): Promise<Result> {
  // Attempt the existing job boundary.
  // Retry only when policy permits and attempts remain.
  // Preserve the final failure as the public result.
}
```

### Ceremonial sketch

Do not add a block that merely repeats a mechanical edit or says existing behavior is unchanged:

```ts
export const SCHEMA_VERSION = 2;
function validateEstimate(...) { /* unchanged */ }
```

A source citation plus “bump the version; validation logic remains unchanged” is clearer.

## Alternatives and repetition

Record credible implementation alternatives only when they explain a consequential implementation choice. State a rejected alternative once with the rejection reason; do not thread its hypothetical implementation through the active change set.

Do not use `PLAN.md` to preserve rejected owner-target alternatives; those belong in `TARGET_DESIGN.md` when worth retaining.

State each rationale once and cross-reference it when needed. Detail is not repetition.

## Review contract

Review the plan against canonical `TASK.md`, accepted target when present, this contract, repository conventions, `CURRENT_DESIGN.md`, and current source. Do not trust planner claims without inspecting load-bearing evidence.

Review task-contract satisfaction, target fidelity, source grounding, proportionality, implementation completeness, and verification coverage. For delegated commit-aligned execution, also verify fidelity between the accepted temporary execution map and the canonical plan artifacts. Where slicing has been accepted under delegated commit-aligned execution, it may be challenged only when it is objectively invalid or new evidence requires reopening it, not because the reviewer prefers another decomposition. This boundary narrows only preference-based re-slicing; it does not limit the proportionality review below or prevent findings about other plan defects. Do not relitigate task intent or an accepted owner decision as a plan defect. If `TASK.md` is materially ambiguous or internally conflicting, classify it as a **task-intent finding** that reopens the task contract. If the target appears incoherent, unsafe, or contradicted by source, classify it as a **target-design finding** rather than demanding that planning choose another target.

Test proportionality symmetrically:

- For each sketch, name the ambiguity it resolves. If none exists, remove it as over-planning.
- For each material implementation ambiguity raised by the change, confirm the plan resolves it or marks it as an explicit implementation question. Missing resolution is under-planning.
- Reject unnecessary abstractions, speculative scope, redundant layers, premature migrations, and disproportionate verification.
- Identify missing dependencies, integration work, edge cases, compatibility concerns, failure behavior, migration or rollback needs, and verification.

Classify every actionable finding as one of:

- **task-intent finding** — `TASK.md` is materially ambiguous, conflicting, or missing an owner-level outcome, scope, or acceptance decision;
- **plan defect** — the plan fails the task or target contract, or contains a planner-owned implementation or verification problem;
- **research defect** — `CURRENT_DESIGN.md` or another current-state claim is materially wrong or incomplete;
- **target-design finding** — accepted target is incoherent, unsafe, impossible, conflicts with `TASK.md`, or requires a new owner-consequential decision.

Each finding must include severity, classification, artifact location, evidence, impact, and the smallest adequate next action. Distinguish confirmed defects from hypotheses and subjective preferences. A different but adequately justified reversible implementation choice is preference, not a defect. State plainly when no actionable finding exists; do not manufacture criticism.

An independent reviewer is read-only and must not revise canonical artifacts. In an interactive review-only session, first identify findings using this contract; revise planner-owned artifacts only when the active Tasks workflow permits it. Task-intent, research, and target-design findings must return to their owners.