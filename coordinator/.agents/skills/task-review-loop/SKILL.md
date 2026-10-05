---
name: task-review-loop
description: Review the aggregate change of a delegated Tasks task, route bounded remediation, and handle owner-identified external feedback. Use after eligible implementation TODOs close or when the user identifies feedback on such a task.
---

# Task-wide integration and feedback review

This workflow owns the final aggregate review gate, not per-TODO approval. Read `../tasks/SKILL.md`, the `herdr-delegation` skill, and `../implement-loop/SKILL.md` when remediation needs implementation. Require the user's explicit delegation, a verified automated task-scoped grant, or the user's affirmative manual-mode approval for this exact action. Checked TODOs alone are not task completion.

## Ledger and review input

Use local ignored `REVIEW.md` as an append-only, numbered, free-form round history. Preserve previous reasoning and identify the current approved round with **at most one standalone** line `Currently approved round: **N**.`. An unresolved findings round must not become approved merely because it was appended. Before a new pass, inspect current source rather than treating past ledger entries as proof of current correctness.

Compile bounded review input from `TASK.md`, accepted `TARGET_DESIGN.md` when present, relevant `PLAN.md`, completed TODO commits, concise reviewed surfaces in completed `STEP-<N>.md` for no-commit/mixed work, cross-step behavior, and end-to-end acceptance evidence. Reading prior STEP files for this integration input is the narrow Tasks exception; do not review unrelated repository state.

## Independent integration pass

Spawn a fresh `integration-reviewer` in the implementation repository through `herdr-delegation`. Its first task prompt instructs it to load Tasks, perform a High-effort, read-only review of the aggregate task change against contract and end-to-end acceptance, and write an explicit verdict and only evidence-grounded actionable findings to a distinct `/tmp` Markdown report. Do not provide worker transcripts or treat its confidence as evidence. Retain the reviewer pane while findings are triaged or remediated; record agent and pane identity in the active review checkpoint.

The coordinator independently checks consequential findings and verification gaps against source, classifies accepted and rejected findings with reasons, and appends the round to `REVIEW.md`. If the aggregate passes, explicitly approve that round, update the single approved-marker line, reread the ledger, report evidence and limitations, and close the recorded reviewer pane. Do not mark the task complete when owner-held acceptance or another gate remains open.

## Internal remediation

An accepted finding is not a silent instruction to modify the task. For a bounded fix, the coordinator appends an accepted `PLAN.md` slice with outcome, dependencies, affected surface, verification and atomic commit boundaries, size, review effort and evidence-based risk rationale, then adds matching TODO(s) under Tasks gates. If findings invalidate the target, task contract, or overall decomposition, return to the user or `../plan-review-loop/SKILL.md` as appropriate; do not disguise redesign as a tiny remediation.

Keep the original integration reviewer for the accepted round. In manual mode, require the user's approval before starting each remediation TODO; in automated mode, verify the task-scoped grant and owner gates. Run each remediation TODO through `../implement-loop/SKILL.md`, spawning a worker but **adopting the retained integration reviewer** for narrow verification of the accepted findings and regressions. The retained reviewer does not receive its role prompt again; it does not begin a fresh search. Coordinator triage, same-worker correction cap, attribution, commit/no-commit choice, and STEP closeout still apply. If there are several remediation TODOs, verify all accepted findings and aggregate acceptance evidence before approving the round. Record the closing outcome in `REVIEW.md`; the retained reviewer's terminal narrow approval can close the round without a second full aggregate sweep. This is a deliberate bounded stopping rule, not permission to ignore unresolved findings.

If the retained reviewer is lost or cannot carry its context, a substitute may receive the accepted findings for narrow verification; if none can do so, spawn a **fresh** integration reviewer over the new aggregate state. Close only panes owned by this workflow when they are superseded or terminal. Any unresolved owner gate or reviewer dispute stops with an explicit ledger checkpoint rather than advancing the approved marker.

## Owner-identified external feedback

Never monitor, fetch, post, or dismiss external feedback autonomously. The user first identifies the feedback. The coordinator reads it and spawns a fresh read-only `advisor` through `herdr-delegation` to assess it against current source, task contracts, accepted plan and review history. The coordinator verifies the assessment and recommends adoption or rejection; **the user decides**. Record the batch as another numbered round.

Accepted feedback creates owner-approved plan amendments and TODOs where required; each remediation TODO passes the per-step review and a fresh task-wide integration review before the marker advances. Rejected feedback retains its rationale in `REVIEW.md`. Draft any external dismissal, but do not post a reply or dismissal without the user's affirmative approval of the **exact text**.

## Continuity and cleanup

A stopped round records in `REVIEW.md` the reviewer name/pane, accepted findings, exact pending decision or remediation TODO, next action, and whether the reviewer is still alive; `STEP-<N>.md` owns per-remediation execution state. A later session verifies canonical task state and actual live pane identity before reusing it; if ownership or agent status cannot be established, stop rather than inventing a retained reviewer. The launcher stores no workflow state. At terminal approval, explicit abandonment, or blocker resolution, report round and residual risk and close only recorded coordinator-owned panes, reviewer before any worker. Never advance the marker on agent status alone.
