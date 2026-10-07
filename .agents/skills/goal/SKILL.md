---
name: goal
description: "The Janus goal system: define and activate durable ambitions, agree and schedule near-term commitments, verify them during daily check-in, handle postponement, review progress, and replan or close honestly. Load when the conversation creates, steers, pauses, resumes, reviews, or closes a goal; allocates goal preparation time; or reports goal progress or postponement. Check-in loads it for daily commitment review."
---

# Janus Goals

Goals own direction; tickets own execution; calendars own scheduled time. Operate this workflow naturally from the conversation, not only through commands. Do not run every operation on every turn.

## Context and ownership

Read `brain/projects/janus/Janus Goal Workflow.md` for the record contract, `brain/HOME.md`, the relevant complete goal file, `tickets/BOARD.md`, relevant goal-linked tickets, and `brain/Working Model.md` before planning. Read `brain/Precedents.md` before accountability escalation. Use today's journal and recent evidence only as needed. Discover paths first; do not reload unchanged context already read in this session.

- `brain/goals/G-NNN-<slug>.md`: definition, completion evidence, roadmap, lifecycle, current milestone, strategy, and material review conclusions. Not a weekly execution queue.
- Ticket `## Goal commitment`: the agreed near-term output, blocks, evidence, and postponement count. Its append-only work log owns commitment history. Board state still follows the tickets skill.
- Calendar: scheduled blocks. A ticket's block reference is context, not a second calendar.
- Journal: decisions no ticket owns and brief session references, not reminders or duplicate ticket content.
- HOME: bounded links, current focus and milestone. Do not require the obsolete `## Active Goals` layout.

## Authority

Read and summarize, record user-reported results and postponements, and maintain factual commitment checkpoints without further approval. Suggestions, calendar gaps, and task age are not agreements or evidence of failure.

Get explicit approval before activating a goal, establishing or changing a commitment, changing goal lifecycle, health, milestone, strategy, target, or capacity, or closing it. Load decisions for user decisions, tickets for ticket work, and projects for project steering. Each operation retains its own approval boundary; approval of a goal does not approve tickets, calendar writes, or external accountability invitations.

Do not schedule, invite, or contact anyone without approval of the exact action and applicable authority. If no authorized scheduling interface is available, help the user place the block manually and retain `calendar status: proposed` until placement is confirmed. No background monitoring, fabricated results, insults, or unilateral goal changes.

## Define and activate

Trigger: a durable ambition is proposed or an existing intention needs qualification.

1. Search canonical goals and relevant project/ticket context for overlap. Classify as goal (durable changed state/capability), project (bounded deliverable), practice, ticket, or lightweight action. Route non-goals through their existing workflows.
2. Resolve desired outcome, why now, observable completion evidence, baseline, realistic capacity and horizon. Ask one consequential question at a time, with a recommendation; do not interview for context already available. Resolve constraints, dependencies, non-goals and pause conditions only where they change the decision.
3. Distinguish hard and aspirational targets. Omit target fields when no honest date exists. Work backward to evidence-based milestones. Give month-level estimated windows only where justified; sketch three to six checkpoints for the current milestone, not an invented long curriculum.
4. Surface competing commitments and what activation displaces. Preview the complete goal record, initial evidence-backed health, and bounded HOME change. Approval of corrections is not assumed.
5. Scan canonical goal filenames, reject duplicate IDs, allocate the next `G-NNN`, and rescan immediately before writing. Never overwrite a conflicting path. Write only the approved goal and HOME changes.
6. Resolve the first commitment through Commit and schedule, or explicitly agree a dated/event-based review point for choosing it. An active label is not a work commitment. Create any needed ticket separately through tickets Capture; capture is not activation.

## Commit and schedule

Trigger: weekly planning, goal kickoff, completion of the current commitment, or an explicit commitment change.

1. Review actual results and remaining agreed work first. Select one near-term output that advances the current milestone. Prefer an existing ticket; create new managed work only through tickets Capture.
2. Propose the output and inspectable evidence, realistic blocks, first physical action, per-session stopping point, review point, and the optional activity displaced. Respect employment, sleep, exercise, recovery, and uncertainty; do not fill all spare time. Narrow the starting step when resistance is high without silently weakening the output.
3. Obtain explicit agreement to the output and blocks before recording a commitment. A weekly capacity aspiration or suggested focus is not a commitment. Weekly planning can happen in normal conversation; no `/weekly-reflection` invocation or weekly journal is required.
4. Record the approved commitment in the ticket using the Goal Workflow contract. Use stable local commitment and block labels so one block cannot be counted twice. Put fixed-time blocks on the calendar only through an authorized, approved action; record actual placement/confirmation, not assumed success.
5. End with the next block, first action, stopping point, and what it replaces. If time cannot be chosen now, record an explicitly agreed review point rather than pretending the work is scheduled.

## Verify daily

Trigger: daily check-in, or the user reports a relevant result/displacement during the day. Check-in completes its Dream gate before these reads.

1. Inspect canonical active goals and non-closed goal-linked tickets, including Ready tickets, for outstanding `## Goal commitment` records. Do not rely on the Active list or the last three journals to discover commitments. Read paused-goal commitments only when resolving them, not to demand work.
2. Compare elapsed agreed blocks with ticket evidence and user reports. Classify as fulfilled, confirmed postponement, excused displacement, or unknown. Missing notes and calendar attendance alone do not establish completion or postponement. Ask one focused question about unknown results only after gathering.
3. Record confirmed results immediately through the tickets skill, maintaining the commitment checkpoint and append-only work log. Check acceptance only against evidence; whole-ticket completion still requires its normal approval.
4. Show today's agreed output/block, next action and verified count when there is an outstanding commitment. If none exists for an active goal, say it has no agreed commitment and recommend the smallest commitment decision; do not invent one or count inactivity as missed blocks.
5. Resolve confirmed displacement with a replacement block, an explicit output/plan change, or an explicitly agreed review point. Never silently roll the date forward. At the threshold, run Handle postponement.

No separate nightly questionnaire. This runs when Janus is used, not as autonomous daily surveillance.

## Handle postponement

1. Count each distinct, confirmed missed or deferred agreed block once toward the same commitment while its promised output remains unmet. Record block label, original time, reported reason, evidence/source, and eligible count. A block moved repeatedly before it occurs is one distinct block, not multiple strikes; separate agreed replacement blocks can each qualify.
2. Illness, genuine urgent obligations, and necessary recovery are excused displacement: retain the record but exclude it from the escalation count and replan. Do not reinterpret every instance of fatigue as avoidance. If the reason is uncertain, ask; unknown is not a strike.
3. Rescheduling or partial progress does not erase prior eligible postponements. Fulfilling the promised output closes the commitment. An approved output change preserves the old commitment's history and disposition rather than quietly resetting its count.
4. At three eligible postponements, apply the active Harsh accountability after three goal postponements precedent (P-001), after verifying it in `brain/Precedents.md`: harsh, performed anger; confront recorded choices and likely consequences; question whether the goal deserves active status; require an executable action or explicit replanning, not vague recommitment. Do not present performed anger as actual feelings or infer that the user does not care as a fact.
5. When capacity exists now, recommend a small immediate action with an observable stop. Otherwise require a realistic replacement block and a named competing activity removed, or recommend revising/pausing the plan. The user decides; do not force action, change status, or repeat the same scolding after a conscious decision without new evidence.
6. Record the escalation and resulting decision once in the ticket. Judge usefulness by subsequent follow-through, not whether the exchange felt motivating. If repeated escalation does not help, recommend changing the intervention.

Do not retroactively assign strikes from vague historical inactivity. Start from documented agreed blocks and confirmed outcomes.

## Review and replan

Trigger: weekly planning/review, milestone completion, changed constraints, repeated displacement, or a request about goal state.

1. Compare raw evidence with milestone completion criteria, pacing windows and current Path. Separate activity from demonstrated progress. Inspect actual allocation, not just declared weekly capacity.
2. Ask whether the goal remains worth the tradeoff. Recommend one direction: continue, revise, pause, or close. An active goal need not receive work every week, but deliberate deferral needs a reason and review point, not silent drift.
3. Preview material changes to lifecycle, health, milestone, strategy, target or capacity and get approval. Never silently extend a target or weaken evidence to claim success. Record accepted changes and reasons in the goal's dated Decisions through decisions.
4. Update material Current Understanding in the existing goal record: last reviewed, obstacle, latest evidence and review conclusion. Do not create a second weekly execution record. On milestone completion, preview the next milestone's Path and justified window recalibration.
5. Reconcile affected tickets through tickets and affected projects through projects. Outstanding commitments require an explicit disposition; pause does not silently erase them. A pause records reason, date and reconsideration trigger; resume requires an explicit capacity decision.

## Close

Trigger: completion evidence appears satisfied or the user chooses abandonment.

1. Read the complete goal and supporting artifacts; compare every completion criterion against evidence. A passed date or completed ticket is not proof. Recommend keeping active or pausing if completion is unsupported; abandonment remains a valid user choice.
2. Review every non-closed linked ticket. Resolve each disposition explicitly: retain historical goal relationship, remove the relationship, move to another goal, or drop with reason. Do not infer dispositions or drop useful work.
3. Capture the final outcome/evidence or abandonment reason, lessons, and useful continuing projects/practices. Preview the goal, HOME and affected ticket changes; approve ticket mutations separately.
4. At the existing stable goal path, set `status: completed` or `abandoned`, add `closed: YYYY-MM-DD`, remove current progress health, append the dated decision and Closure section. Keep definitions and history; never delete, rename, archive or overwrite the goal. Update HOME if it presents the closed goal as active/current.
5. Apply only approved changes, rereading if files changed after preview. Report the evidence disposition and the affected work.

## Delivery

Use goal/ticket titles with IDs. Lead with the decision or next action. Keep ordinary check-ins brief; do not bury missing evidence or threshold escalation to meet a line limit. State what was actually recorded, scheduled or verified and what remains unknown.
