---
name: book
description: "The Janus book system: capture candidates, recommend reading, activate bounded managed-book plans, agree and schedule reading or learning-closeout commitments, verify progress during daily check-in, handle postponement, review, pause/resume, and close. Load when the user discusses a book to remember or read, asks for a reading recommendation or plan, reports reading progress or postponement, or steers a managed reading plan. Check-in loads it for daily reading-commitment review."
---

# Janus Books

Support deliberate reading without turning the bookshelf or recreational reading into an obligation queue. Operate naturally from the conversation, not only through commands. Books are inputs or bounded reading plans, not automatically canonical goals.

## Context and ownership

Read `brain/projects/janus/Janus Reading Workflow.md` fully for the record contract, `brain/HOME.md`, `brain/Reading.md`, relevant managed-book notes, and `brain/Working Model.md` before planning. Discover book paths under `brain/reading/`; search the catalog, brain, and matching root captures for duplicates or alternate editions. Read all active/synthesis-pending managed books when estimating shared capacity/slots. Read relevant goal/ticket context for linked work and `brain/Precedents.md` before escalation. Use recent evidence as needed; do not reload unchanged context already read.

- Reading hub: lightweight candidates and managed-book links. A candidate creates no plan, deadline, goal, ticket, commitment or occupied slot.
- Managed book: identity, scope, lifecycle, target, progress, provisional pacing, learning contract, `## Reading commitment`, `## Reading history`, synthesis, and material Decisions.
- Calendar: scheduled blocks. Book block references preserve context, not a second schedule.
- Tickets: substantial application/design work only. Do not create a ticket for routine reading or each session.
- Journal: decisions no managed book/ticket owns and brief material references, not daily prescriptions, mandatory forms or another counter.
- Weekly planning/review: conversational operations. No weekly journal or command is a prerequisite.

## Authority and boundaries

Record user-reported ending positions and factual progress immediately without a second approval. Preserve the source and uncertainty; ask one compact clarification when the ending position is ambiguous. Do not infer minutes, comprehension, completion or a missed block from silence.

Preview and obtain explicit approval for candidate capture when metadata is inferred, plan activation, new/changed commitments, scope, target, lifecycle, learning contract, health or material pacing changes. A correction is not automatically approval. Read decisions for user decisions; projects/goal/tickets when steering their work. Whole-plan completion needs evidence and explicit approval.

Default plans are deadline-bearing nonfiction or technical reading. Fiction is recreational: catalog or retain reflections only by explicit request; no deadline plan unless the user explicitly changes that boundary. Candidates and recreational reading are excluded from accountability counting.

At most three plans with `plan_status: active` or `synthesis_pending` occupy slots. This is a ceiling, not a target. Paused plans do not occupy a slot. Do not activate/resume a fourth; resolve an existing plan's disposition first. A goal relationship does not entitle a book to preparation time or let it displace independent practice silently.

Calendar writes, external calls and invitations follow the applicable authority rules. No approval of a book automatically approves scheduling or live lookup. If an authorized calendar-writing interface is unavailable, help the user schedule manually and retain proposed status until placement is confirmed. Never claim background monitoring.

## Capture or recommend

Trigger: the user wants a book remembered or asks what to read.

1. Read the catalog and relevant intent, active plans, goals/projects, ownership and capacity. Recommend one default and at most one materially different alternative. A recommendation does not activate a plan.
2. For capture, search duplicates and alternate editions. Preserve lightweight title, author when known, topic/type, availability (`owned` or `interested`), and optional reason. Do not create a managed note for a candidate alone.
3. For identity/edition/contents research, read `commands.md` and use `brain:book:lookup` by strongest identifier (ISBN, supported URL, otherwise title/author). This uses live external services: obtain applicable authority first. User-supplied metadata can be retained with its source without requiring online research merely for clerical completeness.
4. Do not silently choose an ambiguous edition. Present candidates and ask for a selection; rerun by ISBN when authorized. Report lookup failure, partial/unavailable contents and independent metadata/TOC sources honestly. Never invent chapters.
5. Preview the sourced details/available TOC and exact lightweight catalog row. Escape table pipes. Add only the approved entry without rewriting unrelated entries. Rich TOC is not persisted for a candidate. Existing managed books are updated/referenced rather than duplicated.

## Activate a plan

Trigger: the user wants to finish a selected book or deliberately manage its reading.

1. Establish why now, exact edition, included/excluded scope, current position, honest reading target (`hard` or `aspirational`), plausible capacity/unavailable periods, learning contract, and optional one primary `goal: G-NNN`. Use context instead of a fixed questionnaire. Curiosity is enough, but the plan must deserve its time and slot.
2. Prefer named sections, then chapters, stable pages, ebook locations, percentage. Store trustworthy sourced contents in the managed note, with completeness and provenance; omit unavailable contents rather than reconstructing them.
3. Build only a provisional content-paced roadmap justified by the target, scope and actual capacity. Treat initial reading as calibration when speed is unknown. For horizons of at least four weeks, leave about a week's reading buffer when feasible. Do not make an unsupported deadline credible by inventing speed or extra minutes.
4. Preview the complete managed note, occupied slots/time displaced, candidate-row removal and Reading-hub link. Use `brain/reading/<Title> — <Author>.md` (title alone if author unknown). Rescan path/slots immediately before writing; never overwrite a conflict.
5. Apply only approved activation changes. Resolve the first commitment through Commit and schedule, or explicitly agree a dated/event-based review point for choosing it. An active label is not a scheduled session.

## Commit and schedule

Trigger: kickoff, weekly planning, a daily check-in reading-allocation proposal, completion of an agreed checkpoint, or an explicit commitment change.

1. Review outstanding agreements and actual position first. Choose one near-term content checkpoint or bounded learning-closeout output; scope and evidence must fit realistic blocks. Future roadmap checkpoints are estimates, not commitments.
2. Agree the output/evidence, blocks, first physical action, time-limited stopping points, optional activity displaced and review point. Zero-book days are valid; one managed book per day is the default, two require an explicit reason. Include reading in the same capacity assessment as goal preparation, work, exercise, sleep and recovery.
3. Obtain agreement before recording `## Reading commitment` using the Workflow contract. Use stable owner-path plus local commitment/block labels to prevent duplicate accounting. Do not require notes from every session unless the learning contract explicitly requires them.
4. Put fixed-time blocks on the calendar only through an authorized approved action, or record the user's confirmation of manual placement. Proposed times are not confirmed events.
5. If a block/output is also an existing goal-ticket commitment, identify one authoritative owner, record a link in the other record, and verify/count it once. Ordinary reading belongs to the book; substantial application work belongs to its ticket. Never maintain two copies of live blocks/counters, add their counts together, or migrate existing histories without approval. Keep a new unrelated reading agreement separate.
6. End with the next agreed block, first action, stop and displaced activity. If scheduling is unresolved, retain the explicitly agreed decision/review point rather than silently deferring to weekly reflection.

## Verify daily and record progress

Trigger: daily check-in or a reading result/displacement reported during the day. Check-in completes its Dream gate before these reads.

1. Discover managed books with `plan_status: active` or `synthesis_pending`, read outstanding reading commitments and supporting history, resolve shared-owner links, and compare elapsed blocks with actual evidence. Do not depend on the last three journals, a weekly note, or the Reading-hub summary to establish results.
2. Missing evidence is unknown, not postponement or zero progress. Ask one focused result question after gathering. If a managed plan has no current agreement, surface that gap and recommend a small commitment decision; do not invent a prescription or strikes.
3. On the user's report, update canonical `current_position` and Current understanding immediately, keeping them consistent. Append a concise sourced progress/history entry; minutes and learning points are optional unless pre-agreed. Record any supplied learning without manufacturing explanations on the user's behalf.
4. Record confirmed block outcomes and maintain the live commitment/evidence count in the authoritative owner. A session honored through its agreed stop is not a postponement merely because the content aim took longer; use that as pace evidence and replan. Partial progress does not erase earlier qualifying misses or automatically fulfill the whole promised output.
5. Each daily check-in considers whether one active book/closeout fits today's actual capacity and priorities. Confirm an existing block; if none is agreed for today and reading fits, propose one concrete book, time box/block, content aim, stopping point and displaced activity through Commit and schedule. A proposal becomes a commitment only when the user agrees; do not silently change an existing checkpoint, target or budget. Zero-reading days are valid when capacity/priorities warrant them. Show agreed work and its verified count, clearly separating unapproved proposals. Coordinate with goal verification so a shared agreement is reported and escalated once.
6. When the agreed reading scope is confirmed complete, record the factual ending position; preview the lifecycle transition to `reading_status: read`, `plan_status: synthesis_pending`, actual `reading_completed`, and default `closeout_due` seven days later. Obtain approval before the lifecycle change and establish a separately agreed closeout commitment. A reported finishing date, not the current date by assumption, assesses the reading target.

No nightly ritual, compulsory exact-minute log, streak or page-count score.

## Handle postponement

1. Count each distinct confirmed missed/deferred agreed block once for the same unfulfilled output; use owner-path and block label as its identity. Repeatedly moving a block before it occurs is one block; distinct agreed replacement blocks can qualify separately. Record original time, reason/source, eligibility, count and the resulting decision in Reading history (or the shared ticket's work log).
2. Illness, genuine urgent obligations and necessary recovery are excused displacement: preserve evidence, exclude from the escalation count and replan. Clarify uncertain reasons; do not interpret all fatigue as avoidance.
3. Rescheduling and partial progress do not reset the count. Fulfilling the promised output closes the commitment. Scope changes, pause or abandonment preserve the prior commitment's history/disposition rather than laundering it into a new zero-count agreement.
4. At three qualifying postponements, read and apply Harsh accountability after three goal or reading postponements (P-001). Use harsh, performed anger, evidence-backed consequences and a challenge to whether this plan deserves its active slot; require a concrete action or explicit replanning, not vague recommitment. Do not claim actual feelings, infer motives as fact, insult, coerce, or change the plan unilaterally.
5. Recommend a small immediate action when capacity exists; otherwise resolve a realistic replacement block with the competing activity removed, or recommend revising/pausing the plan. Record escalation and the user's decision once. Respect conscious decisions; judge the intervention by subsequent action, not emotional intensity.

Do not retroactively count stale plans, old task age, or absent weekly/session records as missed agreements.

## Review, replan, pause or resume

Trigger: conversational weekly review/planning, changed pace/capacity, repeated displacement, target risk, or an explicit request.

1. Review current position, agreed output/block evidence, learning, observed pace, shared capacity, the target, and whether the book still deserves its slot. Recommend one direction rather than rolling the plan forward automatically.
2. When target/scope/capacity conflict, offer explicit bounded catch-up, reduced scope, revised target, accepted risk, pause or abandonment; recommend the smallest realistic change. No automatic extra minutes or deadline extension. Reading must not replace the independent skill evidence a supporting goal needs.
3. Preview material health, target, scope, learning-contract, pacing or lifecycle changes; apply only on approval and append dated Decisions. Ordinary reported position/evidence updates need no second approval.
4. Pause sets `plan_status: paused`, reason/date, and reconsideration trigger. Preserve `reading_status: read` if reading is finished; otherwise set it to `paused`. Preserve the current phase, progress, targets, outstanding commitment disposition and history. Pause frees the slot without representing completion.
5. Resume requires an explicit value/capacity/slot decision. Return to `active` if reading scope remains, or `synthesis_pending` if only learning closeout remains. Review stale targets and agree work rather than silently reusing old allocations.
6. Update the existing Reading-hub view and propagate actual goal/project learning through their skills only when material; do not create another weekly execution record.

## Close or abandon

Trigger: learning evidence is ready, the user chooses abandonment, or a completed-book reflection is requested.

1. Reading completion is not full plan completion. Check the agreed learning contract: default three to five ideas worth remembering, what changed/became clearer, and one application, experiment or unresolved question. Stronger technical evidence must have been agreed before claiming success.
2. Prepare the user's evidence-based synthesis without inventing understanding or presenting book claims as independently verified facts. Promote only verified reusable knowledge through the normal knowledge rules.
3. Preview and approve `plan_status: completed`, `closed: YYYY-MM-DD`, evidence/lessons and Reading-hub update. A synthesis-pending plan occupies its slot until completion, pause or abandonment.
4. For abandonment, record reason, date, useful learning and the explicit disposition of any linked commitment/application ticket; set `plan_status: abandoned` and preserve actual progress (`reading_status: read` if already finished, otherwise `dropped`). Do not silently drop an independent goal or useful ticket.
5. Keep the managed book at its stable path with Decisions and history. Report reading completion and learning completion separately.

## Delivery

Be concise, with one recommended next action. Report what was recorded/scheduled/verified and what remains unknown. Never turn a recommendation, active plan or future checkpoint into an assumed agreement.
