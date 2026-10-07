---
name: weekly-reflection
description: Review the ISO week through journals, ticket evidence, goals, projects, reading, and capacity; then select a small set of next-week outcomes. Use for `/weekly-reflection`.
disable-model-invocation: true
---

# Janus Weekly Reflection

Review the week as a system, then choose a deliberately small set of outcome commitments without turning the weekly note into another ticket store or personal-metric report.

## Hard boundaries

- Read `commands.md` before package commands and create or resume `journal/weekly/YYYY-Www.md` through `pnpm brain:weekly:create -- --date YYYY-MM-DD --json`.
- `tickets/BOARD.md` owns ticket workflow state; ticket files own outcomes, checkpoints, acceptance, and work logs. The weekly note references them but never copies their canonical state.
- Always render ticket title before ID.
- Review actual ticket evidence, not checkbox counts, remembered effort, or missing daily checkout records. Janus has no checkout ritual.
- Keep at most two active discretionary tickets and five ready tickets.
- Use three total next-week outcome commitments as a soft default. Fewer are valid; recommendations above three require a capacity argument and explicit approval.
- Weekly selection does not activate ready tickets. ticket Start (tickets skill) owns activation at execution time.
- New managed work is created through a separately approved ticket Capture (tickets skill) interaction, not the legacy backlog task CLI.
- For reading review/planning, read `.agents/skills/book/SKILL.md` fully and follow it. Reading uses the same shared capacity; managed books own routine-reading/closeout commitments and history. The weekly report is optional and not an allocation prerequisite. Shared goal/reading agreements have one owner/counter.
- Do not reconstruct or request routine wellbeing, sleep, stress, focus, short-form, or Pomodoro histories. Personal health data remains outside Janus. External device or app evidence may be used only when Greyy explicitly supplies it for a specific decision.
- Material goal, managed-book plan/lifecycle, project, HOME, and durable knowledge changes require explicit preview and approval. Factual reported reading positions update immediately under the book skill without a second approval.
- For goal review and commitment planning, read `.agents/skills/goal/SKILL.md` fully and follow it. This optional weekly report is not the authority or prerequisite for goal planning. Goal commitments and postponement history live in the owning tickets; weekly notes reference them rather than creating a competing execution record.

## Required context

1. `brain/HOME.md` and every canonical active goal.
2. All daily journals in the returned ISO period, especially accepted `## Dispatch` decisions, `## Changes`, ticket-session references, notes, and reading evidence recorded when it happened.
3. `tickets/BOARD.md` and all ticket files touched during the week or currently `active`, `ready`, `waiting`, or `verifying`; include recent `done` and `dropped` records needed to understand outcomes.
4. The preceding weekly reflection and its commitments and reading plan.
5. Relevant project entry pages and latest project-control state for projects receiving or competing for capacity.
6. `brain/Reading.md` and every managed book with `plan_status: active` or `synthesis_pending`.
7. `backlog.md` as legacy and lightweight context, not the canonical managed-work queue during the trial.
8. Known next-week obligations and current capacity constraints stated by Greyy or represented in the calendar.

## Review posture and flow

Act as an independent third-person reviewer, not a facilitator interviewing Greyy into writing his own reflection.

1. Review all required context without preliminary questions unless a critical evidence gap makes a consequential judgment irresponsible.
2. Draft the complete weekly report in third-person reviewer voice. Do not write first-person reflections Greyy did not author.
3. Lead with a concise executive assessment, then provide the evidence-backed report and every proposed durable change.
4. Clearly distinguish recorded evidence, interpretation, uncertainty, and recommendation. Preserve Greyy's own words when quoting existing notes.
5. Review whether check-in changed meaningful choices from dispatch and execution evidence. Ask one direct retrospective question only when the answer materially affects the workflow assessment; do not recreate a daily influence metric.
6. Include the week in one sentence, meaningful win, turning point, friction, unfinished thread, material operating conditions, `What I notice`, `What this suggests for next week`, `Keep doing`, `Change`, and `Carry forward`.
7. Ask Greyy once to read and verify the complete report. Invite a natural-language reply containing any factual correction, missing context, disagreement, or commitment change; `Approved` is sufficient when accurate.
8. If Greyy disputes a conclusion, revise the affected section directly, ask one focused follow-up only when needed, and respectfully preserve an evidence-backed disagreement rather than automatically accepting a contradictory account.
9. After corrections, show only material revisions unless the full report changed enough to require another complete read. Obtain final explicit approval before applying the weekly record or material durable changes.

## Ticket-system review

Review the week through ticket and displacement evidence:

- Which coherent outcomes became `done`, with what acceptance evidence?
- Which tickets remain `active`, and does each have a trustworthy next move?
- Which tickets are `verifying`, and what evidence remains?
- Which are `waiting`, with what blocker and review condition?
- Did WIP stay within two active and five ready?
- Did daily dispatch usually determine the first meaningful block?
- Could touched tickets resume without reconstructing intent?
- Did checkpoints occur naturally and preserve the state needed to resume?
- Which displacements were justified, bounded, returned from, or allowed to drift?
- Which ready or inbox items should be removed, clarified, dropped, or deferred?

These are system-design questions, not performance targets for Greyy. Missing evidence stays missing.

Recommend explicit state corrections only when the board contradicts ticket evidence. Preview and approve every state change. Do not keep stale work alive merely because it has an ID.

## Goal and project review

For each active goal, run the goal skill's Review and replan procedure: review milestone evidence and actual capacity, outstanding ticket-owned commitments and verified postponements, continued value, and justified health/plan changes. Include the assessment and proposed changes in the report for approval. Do not infer strikes from missing journal activity or reset a commitment's counter when making a next-week recommendation.

For projects receiving consequential capacity, consume their latest approved project-control state. If the milestone or review is missing or materially stale, recommend project review (projects skill) before committing substantial capacity. Do not silently change project lifecycle, scope, milestone, or strategy inside weekly reflection.

## Reading review

For every active or synthesis-pending managed book, run the book skill's Review procedure against its actual position, book-owned/shared agreements, observed pace, learning contract, verified postponements, target and slot value. Prioritize learning closeout without inventing session evidence or strikes. Include proposed material plan/lifecycle changes for approval; factual reported positions need no second approval. Review paused plans only when their reconsideration trigger or a resume decision warrants it.

## Next-week capacity and commitments

Brainstorm capacity using fixed obligations, realistic focus blocks, current stated energy when relevant, active WIP, waiting dependencies, verification work, goal and project priorities, all proposed reading minutes, and deliberate room outside output.

Then recommend at most three outcome commitments by default:

- describe achieved results, not activity quotas;
- prefer completing active or verifying tickets before admitting more ready work;
- reference an existing ticket when it already represents the outcome;
- a weekly outcome may span a short ordered ticket sequence, but the weekly note does not merge those tickets into one execution object;
- do not activate tickets during weekly planning;
- if new managed work is genuinely needed, preview it through ticket Capture (tickets skill) and approve ticket creation separately;
- if ready is full, require an explicit displacement or leave the new item in inbox;
- an active goal is not entitled to weekly capacity.

For goal-linked work, a proposed weekly outcome is not yet an agreed execution commitment. Resolve its output, realistic blocks, first action, stopping point, displaced activity and review point through the goal skill's Commit and schedule procedure. Record the approved agreement in the owning ticket; the weekly report may retain a proposal or link to that agreement, but it does not own its live state or counter. Calendar writes remain separately authorized.

Weekly report outcome shape:

```md
### 1. Complete Chapter 1 and write six foundation notes

- ticket: [[tickets/J-034-complete-chapter-1-foundation-notes|Complete Chapter 1 and write six foundation notes]] · J-034
- why_now:
- outcome:
- start_here:
- done_when:
- watch_for:
```

For a sequence, list each title-first linked ticket and its dependency; do not use a bare ID.

## Reading plan

When this optional report includes `## Next week: reading plan`, use it for recommendations or links to authoritative managed-book agreements, not a second live allocation. Resolve approved content output, blocks, first action, stops, displaced activity and review point through the book skill's Commit and schedule procedure. A proposed checkpoint is not an agreement. Respect the one-book-per-day default and shared capacity; target conflicts require an explicit choice, not hidden extra minutes. Record an agreed reading commitment in its owning book or shared ticket, and verify/count once.

## Weekly record

Render in this order:

1. `The week in one breath`;
2. `Moments worth keeping`;
3. `Operating conditions` for material constraints only, not routine personal metrics;
4. `What the week taught me`;
5. `Ticket-system review`;
6. `Goal reviews`;
7. `Reading review`;
8. `Next week: commitments`;
9. `Next week: reading plan`;
10. `Leave room for`;
11. `Week details` with completed, dropped, active, waiting, and verifying ticket references; reading evidence; change/displacement evidence; and commitment sources.

Keep the first screen narrative-first. Preserve user-authored content when resuming an existing record. Historical notes retain their original checkout, wellbeing, metric-coverage, or legacy task sections; do not rewrite them solely for schema consistency.

## Approval and apply

1. Preview the complete weekly record and all proposed ticket-state, goal, managed-book, project, HOME, and new-ticket changes in one review package.
2. Ask Greyy to read and verify the report and reply naturally with corrections, missing context, disagreements, or commitment changes. Silence is not approval.
3. Revise disputed sections directly; ask focused follow-ups only when the correction itself is ambiguous or conflicts materially with evidence.
4. Apply separately approved ticket Capture (tickets skill) captures first, then refresh any ticket references in the weekly-record preview.
5. Obtain final explicit approval of the weekly record and every material edit.
6. Apply guarded changes. Record separately agreed goal/reading commitments through their skills in the authoritative ticket or managed book, and reference them in the weekly report without duplicate blocks/counters. Do not use legacy task-add or task-movement commands.

## Output contract

Report the weekly record path, journals reviewed, ticket outcomes and open states, WIP and displacement findings, active goals and books reviewed, approved next-week outcomes, reading allocation, newly created tickets, and every durable file changed. Do not report personal-metric coverage or claim a change without approved evidence.
