---
title: Goal Workflow
created: 2026-07-20
kind: system
---

# Goal Workflow

Janus turns durable desired changes into evidence-based milestones and explicit, capacity-backed commitments, verifies them during daily check-in, and replans from observed results.

```text
goal → milestone → agreed output → protected blocks → evidence → review
                                                   ↘ postponement → explicit decision
```

The naturally triggered `goal` skill at `.agents/skills/goal/SKILL.md` owns the procedure: define/activate, commit/schedule, verify daily, handle postponement, review/replan, and close. The user does not need to invoke a lifecycle command. This page owns the record contract and ownership boundaries.

## Ownership

- A goal file owns desired outcome, completion evidence, roadmap, lifecycle, current milestone, strategy, material understanding, and steering decisions.
- An individual ticket owns the near-term agreed output, block references, execution checkpoint, result evidence, postponement accounting, and append-only history. `tickets/BOARD.md` remains canonical for ticket state.
- The calendar owns fixed-time blocks. Ticket references preserve what was agreed; they are not a second schedule.
- Daily journals are passive records of material decisions no ticket owns and brief ticket-session references. They are not reminder or execution surfaces.
- `brain/HOME.md` provides bounded links, current focus and milestone; operational detail stays in the linked records.
- Weekly review is an operation of the goal skill, not a required `/weekly-reflection` command or a new weekly journal. Existing weekly records remain historical evidence.

## Concepts

- **Goal:** A durable desired change in state or capability, usually spanning multiple weeks.
- **Milestone:** An intermediate achieved state with inspectable evidence.
- **Commitment:** An explicitly agreed near-term output with realistic blocks, first action, stopping point, displaced activity and review point. A suggestion is not a commitment.
- **Project:** A bounded deliverable or body of repository understanding; projects may serve goals without becoming milestones automatically.
- **Practice:** Repeated behavior valuable on its own or in service of a goal.
- **Ticket:** One coherent managed-work outcome with context and acceptance evidence, normally finishable in one to four focused sessions.
- **Postponement:** A confirmed missed/deferred agreed block while its commitment's promised output remains unmet. Task age and missing records do not establish postponement.

## Canonical goal record

Location: `brain/goals/G-NNN-<slug>.md`. IDs are never reused. Scan canonical filenames, reject duplicate IDs, take the greatest numeric ID plus one, padded to at least three digits, and rescan immediately before writing. Stop on path/ID conflicts rather than overwrite.

```md
---
id: G-001
kind: goal
status: active
created: YYYY-MM-DD
target_date: YYYY-MM-DD
target_kind: aspirational
---

# Human-readable goal title

## Definition

### Desired outcome
...

### Why this matters
...

### Baseline
...

### Completion evidence
- ...

### Constraints
- ...

### Non-goals
- ...

## Roadmap

### Trajectory
Now → Milestone 1 (est. YYYY-MM) → Milestone 2 (est. YYYY-MM) → Outcome

### Current milestone
**Outcome:** ...
**Estimated window:** through YYYY-MM (estimate, only when justified)
**Completion evidence:**
- ...
**Path:**
1. ...

### Later milestones
#### Milestone 2 — ...
**Outcome:** ...
**Estimated window:** YYYY-MM – YYYY-MM (estimate, only when justified)
**Completion evidence:**
- ...

## Strategy

### Projects
- ...

### Practices
- ...

## Current Understanding
- Health: on_track — evidence-backed explanation
- Last reviewed: YYYY-MM-DD
- Main obstacle: ...
- Latest evidence: ...
- Latest review: dated conclusion or link to the owning decision/evidence

## Assumptions and Risks
- ...

## Decisions
- YYYY-MM-DD: Decision and reason.
```

Omit both target fields when there is no honest date; otherwise `target_kind` is `hard` or `aspirational`. Targets are never extended automatically. Milestone windows are coarse calibration estimates, not commitments. Derive month-level windows from real constraints only; do not invent fine-grained pacing. Only the current milestone needs a three-to-six-checkpoint Path. State when later preparation cannot yet be drawn honestly.

Lifecycle: `active`, `paused`, `completed`, `abandoned`. Health is separate: `on_track`, `at_risk`, `blocked`; paused and closed goals do not need current progress health. Pause records reason, date and reconsideration trigger. Completed and abandoned goal records stay at their original paths with their history.

Do not store a current weekly execution queue, executable ticket list, or session log in the goal. Update material understanding and dated decisions rather than accumulating parallel plans.

## Commitment record

A ticket has at most one primary `goal: G-NNN`. That relationship alone does not entitle it to time. Explicitly agreed goal work uses a `## Goal commitment` section in that ticket, separate from its ordinary Current checkpoint. Use one outstanding commitment per ticket; the work log preserves fulfilled/superseded commitments before the section is replaced.

For a shared routine-reading agreement, this section may instead link to the managed book's authoritative `## Reading commitment`; the book can likewise link to an existing substantial ticket-owned agreement. Follow the book skill and Reading Workflow to resolve one owner and preserve history. Verify/count/escalate the shared agreement once; never duplicate its live blocks or add two counters. A book's independent reading agreement does not automatically become a goal commitment.

```md
## Goal commitment

- Commitment: C1 — agreed YYYY-MM-DD
- Status: open | fulfilled | superseded | paused
- Promised output: ...
- Evidence required: ...
- First action: ...
- Displaces: named optional activity or agreed capacity source
- Review: YYYY-MM-DD or explicit event
- Eligible postponements: 0 — derived from distinct confirmed block outcomes below/work log
- Blocks:
  - C1-B1: YYYY-MM-DD HH:MM–HH:MM Asia/Saigon; stop: ...; calendar status: proposed | confirmed; reference: ...; result: pending | unknown | fulfilled | postponed | excused
- Latest result/evidence: ...
```

Local labels are monotonically allocated within the ticket (`C1`, `C2`; `C1-B1`, `C1-B2`) to prevent double counting. Include actual time zone, calendar reference/confirmation and real stopping point. `proposed` never means successfully scheduled. If scheduling cannot be resolved yet, record the explicitly agreed review point and unresolved blocks honestly. Do not fabricate an event or commitment.

Append material events to the ticket's existing Work log:

```md
- YYYY-MM-DD: Commitment C1 agreed: <output>; blocks <labels>; displaces <activity>; review <point>.
- YYYY-MM-DD: C1-B1 result: postponed; original block <time>; reason/source <user report or evidence>; eligible yes; count 1/3; replacement <approved block or unresolved decision>.
- YYYY-MM-DD: C1-B2 result: excused; reason/source <...>; eligible no; count remains 1/3; approved replan <...>.
- YYYY-MM-DD: Commitment C1 fulfilled: <evidence>; disposition <next decision>.
```

User decisions use the decisions skill's `Decision (user):` format. These event examples do not replace that format or the tickets skill's checkpoint/approval requirements. Check-in may record confirmed evidence without moving board state or declaring the whole ticket done.

## Commitment and daily verification

At kickoff, weekly planning, or completion of the current commitment, select one near-term output that advances the milestone. Agree realistic blocks, first action, stopping point, what loses that capacity and review point. Activation either resolves the first commitment or explicitly agrees when that decision will happen. New tickets are separately captured through tickets; capture is not activation.

Put approved fixed-time blocks on the calendar only through an authorized action, or obtain the user's confirmation of manual placement. Goal approval does not approve external invitations or calendar writes. Protect employment, sleep, exercise, recovery and buffer.

During check-in, after its Dream gate, inspect outstanding commitments across non-closed goal-linked tickets for active goals, including Ready tickets. Verify elapsed blocks against actual evidence. Missing records are unknown: ask about results instead of inventing a miss. Report today's agreement and verified postponement count. If an active goal has no commitment, recommend a commitment decision rather than silently treating it as progressing.

Record results or displacement when reported during the day as well; do not wait for the next check-in. No background surveillance or mandatory nightly questionnaire is added.

## Postponement and escalation

- Count each distinct, confirmed missed/deferred agreed block once for the same unfulfilled promised output. Repeatedly moving one block before it occurs is one block; distinct agreed replacement blocks can qualify separately.
- Illness, genuine urgent obligations and necessary recovery are recorded as excused displacement, excluded from the escalation count, and trigger replanning. Unknown reasons/results require clarification, not a strike.
- Rescheduling and partial progress do not erase eligible misses. Completing the promised output closes the commitment. Approved output changes preserve the prior history/disposition rather than quietly resetting the counter.
- At three eligible postponements, apply [[brain/Precedents|Harsh accountability after three goal or reading postponements (P-001)]] after reading its current conditions: harsh, performed anger; evidence-based consequences; challenge whether the goal deserves active status; require concrete action or explicit replanning instead of vague recommitment.
- The user retains control. No insults, fabricated certainty, claimed actual assistant anger, coercion, or unilateral lifecycle changes. Respect conscious decisions without repeating the same scolding absent new evidence.
- When capacity exists now, recommend a bounded immediate action. Otherwise resolve a realistic replacement block and named competing activity removed, or recommend revising/pausing the plan. Judge the intervention by subsequent action, not emotional intensity.
- Do not reconstruct strikes from old vague inactivity. Existing goals/tickets begin with only verifiable agreed blocks and outcomes.

## Review, replan and closure

Review weekly in normal conversation or when milestone evidence, capacity or repeated displacement changes the decision. Assess the milestone against actual evidence and estimated windows, actual allocated capacity, whether the goal remains worth its tradeoffs, and the recommended direction. An active goal need not receive time every week, but deliberate deferral needs a reason and review point.

Preview material lifecycle, health, milestone, strategy, target or capacity changes and wait for approval. Append reasons as dated Decisions. Reconcile related tickets/projects through their skills, preserving their ownership and approval gates. Do not silently extend windows or lower completion criteria. On milestone completion, approve the next Path and recalibration.

Completion requires every stated completion criterion to map to evidence; elapsed time or ticket completion alone is insufficient. Abandonment records why the goal is no longer worth pursuing and what remains useful. Before closure, explicitly resolve every non-closed linked ticket: retain its historical relationship, remove the relationship, move to another goal, or drop with reason. Obtain separate approval for those ticket mutations.

Closure at the existing goal path sets `status: completed` or `abandoned`, adds `closed: YYYY-MM-DD`, removes current progress health, appends the dated decision, and adds `## Closure` containing:

- closure date;
- final outcome and criterion-by-criterion evidence for completion, or reason for abandonment;
- lessons/what was learned;
- continuing projects, practices and retained work.

Update HOME when its current focus/milestone or active-goal presentation becomes stale. Keep HOME bounded; do not impose a heading that conflicts with its current layout. Never rename, delete or archive the canonical goal on closure.

## Workflow history

- 2026-07-20: Original design used command-only goal creation/closure and weekly-reflection-owned weekly outcomes. Historical weekly records retain their original meaning.
- 2026-10-07: Greyy approved consolidation into a naturally triggered goal skill, explicit output/block commitments owned by tickets, daily check-in verification, recorded postponement accounting, P-001 escalation, and conversational weekly review. This supersedes the command-only/weekly-journal planning requirement; it does not retroactively establish commitments or change G-001's lifecycle, dates or current milestone.
