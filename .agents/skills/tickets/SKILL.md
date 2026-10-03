---
name: tickets
description: The Janus ticket system — how managed work is captured, started, checkpointed, and replanned on `tickets/BOARD.md`. Load whenever a conversation creates, begins, resumes, finishes, pauses, blocks, or displaces a unit of managed work, or when the user refers to a ticket by title or J-NNN.
---

# Janus Tickets

Tickets are Janus's unit of managed work: one deliverable, decision, investigation result, or verification result, normally finishable in one to four focused sessions. Janus operates tickets on the user's behalf. The user should not need to name a phase; recognize it from the conversation.

## Model

### Files and ownership

- `tickets/BOARD.md` is the canonical workflow state. Each ticket appears exactly once, as a wikilink under its state section, followed by ` · J-NNN`. Empty sections contain `_None._`.
- `tickets/J-NNN-<lowercase-kebab-slug>.md` owns the ticket's contract, current checkpoint, acceptance evidence, and work log.
- Today's `journal/YYYY-MM-DD.md` records the morning `## Dispatch`, displacements under `## Changes`, and one-line session references under `### Ticket sessions` in `## Notes`. Never copy ticket content into the journal.
- Project and goal pages under `brain/` own the higher-level understanding the ticket serves.

### Ticket contract

A ticket file has a `# Title · J-NNN` heading and these fields:

- `project`, `goal` (or `none`);
- `why` it deserves capacity;
- one coherent `outcome`;
- observable `done_when`, including verification where relevant;
- `next_move`: the exact action that starts work now when unblocked;
- `blocked_by`, or `none`;
- `## Current checkpoint`: only the latest resumable state;
- `## Acceptance`: checklist, checked only on observable evidence;
- `## Work log`: dated entries, append-only.

Do not manufacture implementation steps that do not reduce uncertainty. Do not accumulate superseded next moves in the header; history belongs in the work log.

### States

- `ready`: worthwhile and actionable. At most five.
- `active`: being worked. At most two discretionary tickets; autonomous agent work does not count against this when the user is not needed.
- `waiting`: progress depends on an explicit external event, person, or ticket. Requires `blocked_by` and a review condition.
- `verifying`: a proposed result exists but acceptance evidence is incomplete.
- `done`: outcome and acceptance evidence satisfied. Construction alone is insufficient when verification matters.
- `dropped`: the user decided the outcome no longer deserves capacity. Record the reason.

`done` and `dropped` do not reopen without an explicit decision and reason.

### Rendering

Always render a ticket as its human-readable title followed by its ID: `Define the chatbot v0 contract (J-037)`. Never make the user resolve a bare ID.

## Authority

Janus acts without asking for:

- reading and briefing;
- moving `ready` → `active` when the user begins work;
- writing checkpoints, work-log entries, and journal session references that reflect what the conversation or authoritative artifacts show;
- moving between `active`, `waiting`, and `verifying` when the evidence is unambiguous.

Janus proposes and waits for the user's approval before:

- creating a ticket whose outcome, done condition, or scope Janus inferred;
- marking `done` or `dropped`;
- displacing today's protected ticket or required pulls;
- exceeding the `ready` or `active` limits;
- reopening a closed ticket.

Never claim progress not supported by the user or an authoritative artifact. Treat routine board maintenance as silent housekeeping; mention it only when it is exceptional or affects a decision.

## Context

Before any phase, read `tickets/BOARD.md`, the complete ticket file, and today's journal when it exists. Read the relevant project or goal page only as far as needed to understand purpose and prior decisions. Do not reload context already read in this session.

Resolve a ticket by title fragment, ID, today's protected ticket, or the most recently discussed active ticket. If resolution is ambiguous, ask one focused question.

## Phases

### Capture

Trigger: the user describes work that should survive the conversation.

1. Classify first:
   - time-specific obligation → calendar;
   - lightweight action or reminder → `backlog.md`;
   - unclear idea or project-sized possibility → un-IDed board inbox item with `captured`, context, and `clarify_next`;
   - coherent ticket → continue.
2. Do not force project-sized work into one ticket. Ask at most one qualification question, preferably: "What observable result should exist after one to four sessions?"
3. Search the board, ticket files, relevant project material, and `backlog.md` for overlap. Extend an existing ticket instead of duplicating it.
4. Preview the contract when Janus inferred material parts of it; write directly when the user supplied it.
5. Allocate the ID immediately before writing: read `janus-backlog: next_task_id=N` in `backlog.md`, check `backlog.md`, journals, and `tickets/` for collisions, take the first unused number at or above `N` (three digits), and advance `next_task_id` in the same changeset. Never reuse an ID. Stop rather than overwrite an existing path.
6. Write the ticket file with a dated creation work-log entry, and add it under `## Ready` or `## Waiting` on the board. Capture never creates an `active` ticket and never adds to today's dispatch unless the user asks.

### Start

Trigger: the user begins or resumes work on a ticket, or asks what to work on and a protected ticket exists.

1. Preconditions: `waiting` cannot start until its blocker resolves; if starting would displace the protected ticket or required pulls, run Replan first.
2. Move `ready` → `active` on the board. Do not duplicate entries for `active` or `verifying`.
3. Brief from Janus context only — do not inspect the source repository during the briefing itself. In natural language:
   - the immediate purpose and the live question that matters now;
   - only the prior context or decision that changes how to proceed;
   - one recommended direction;
   - the exact first physical action.
4. Keep acceptance criteria, limits, and stopping conditions in the background unless they change direction or prevent drift. Label any unverified repository claim as a hypothesis.

### Checkpoint

Trigger any of:

- the user signals stopping, pausing, or switching away;
- a result, blocker, or decision emerges that changes the ticket;
- the user moves to a different ticket while this one has unrecorded progress;
- a long working session reaches a natural break.

When the trigger is implicit, propose the checkpoint in one or two lines rather than interrupting the current answer. Do not let a session end with material progress unrecorded.

1. Resolve only: what materially changed, the exact next move, and the resulting state. When the conversation already answers these, propose the checkpoint and ask for correction instead of interviewing.
2. Apply as one changeset:
   - replace `## Current checkpoint`;
   - update `next_move` (`none — ticket complete` for done, `none — ticket dropped` for dropped);
   - update or clear `blocked_by` and the review condition;
   - check acceptance items only on observable evidence;
   - append one dated work-log entry: what changed, the key learning or decision, state, next move;
   - move the board entry without duplicating it;
   - append a one-line title-and-ID reference under `### Ticket sessions` in today's journal.
3. For a no-progress session, record the blocker or reason and a trustworthy next move. No achievement language.
4. When the checkpoint reveals an architectural constraint, invalid assumption, new risk, milestone progress, or direction change, flag that the project page may need updating.

### Replan

Trigger: interruption, urgency, discovery, or a decision changes the day's selected work.

1. Resolve the displacement:

   ```md
   - displaced: Title (J-NNN)
   - reason: concrete urgency, new evidence, or changed decision
   - replacement: Title (J-NNN) or named obligation
   - cap: bounded time or observable stopping condition
   - return_point: exact checkpoint for resuming the displaced ticket
   ```

2. A strategically interesting idea alone is not urgency. Recommend keeping it as an optional pull or capping it at one to two Pomodoros instead of displacing active goal work.
3. Append the record under today's `## Changes`. Keep the original `## Dispatch` unchanged as the historical morning decision.
4. Checkpoint the displaced ticket when its current state is not enough to resume. It normally stays `active`; move it to `waiting` only for a real blocker.
5. Start the replacement through Start.

## Output

Report naturally and briefly: the ticket by title and ID, what changed, the resulting state, and the exact next action. List changed files only when they matter to the user. Do not run project-wide tests for Markdown-only ticket updates.
