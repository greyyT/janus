---
name: projects
description: The Janus project system — how projects under `brain/projects/` are created, kept current from ticket work, reviewed, replanned, and closed. Load whenever a conversation starts, steers, pauses, finishes, or abandons an initiative; when ticket work changes what Janus knows about a project or repository; or when the user asks about a project's state.
---

# Janus Projects

A project is Janus's higher-level representation of what it currently believes about a body of work. Tickets carry execution; projects carry understanding and direction. Janus maintains projects on the user's behalf. The user should not need to name an operation; recognize it from the conversation.

## Model

### Two project types

- `initiative`: a bounded effort with an observable outcome and an end — a "project" in the Building a Second Brain sense. Has success evidence, a current milestone, health, and closes as `completed` or `abandoned`.
- `repository`: accumulated knowledge about a codebase Janus works in — architecture, conventions, constraints, decisions, pitfalls. Has no outcome or end; it stays current as long as the repository matters.

Do not force one type into the other. If something is neither — a goal, a recurring practice, a single deliverable, or loose reference material — it is not a project.

### Location and identity

- Entry page: `brain/projects/<slug>/<Human-readable Title>.md`, slug in lowercase ASCII kebab-case. Supporting notes live beside it.
- Projects have no numeric ID. Always refer to a project by its title.
- Search `brain/projects/`, root inbox notes, and tickets for overlap before creating. Never overwrite an existing entry page.

### Entry page

```md
---
title: Human-readable Title
created: YYYY-MM-DD
kind: project
type: initiative | repository
---

# Human-readable Title

One-sentence description.

## Project control

- Status: active | paused | completed | abandoned | archived
- Health: on_track | at_risk | blocked — reason   (initiative only)
- Last reviewed: YYYY-MM-DD
- Next review: YYYY-MM-DD or event trigger

### Outcome / Why now / Success evidence / Scope / Non-goals   (initiative only)

### Current milestone   (initiative only)

**Outcome:** ... **Evidence:** ...

### Current understanding

The latest state needed to steer or work in this project. Replaced in place.

### Risks and dependencies

### Active tickets

- [[tickets/J-NNN-slug|Ticket title]] · J-NNN

### Decisions

- YYYY-MM-DD: Decision and reason. Append-only.
```

For `repository` projects, `### Current understanding` is the main body and may grow into sections (architecture, conventions, constraints, pitfalls) or linked notes. Source code and repository docs stay authoritative; record what is useful to know before reading the code, and do not duplicate repository-owned documentation.

### Ownership

- Projects own outcome, boundaries, milestone, health, current understanding, risks, and steering decisions.
- Tickets own checkpoints, next moves, acceptance evidence, and session history. Never copy those into the project page.
- Goals own durable desired changes. A project may serve a goal; closing one does not close the other.

## Authority

Janus acts without asking for:

- reading and summarizing project state;
- updating `### Current understanding`, `### Risks and dependencies`, and `### Active tickets` from ticket evidence;
- recording milestone evidence that a ticket's acceptance evidence proves.

Janus proposes and waits for the user's approval before:

- creating or activating a project;
- changing outcome, success evidence, scope, non-goals, or the current milestone;
- changing status or health;
- pausing, completing, abandoning, or archiving;
- changing ticket states as a consequence of a project decision.

Never invent capacity, deadlines, or success evidence. Never weaken success evidence to justify completion.

## Operations

### Create

Trigger: the user wants to start an initiative, or Janus will work repeatedly in a repository that has no project page.

1. Classify: goal, project (which type), practice, ticket, or reference capture. If it is not a project, say where it belongs and stop.
2. For an `initiative`, resolve only what controls it: outcome, why now, success evidence, scope and non-goals, nearest milestone, risks, supporting goal, capacity source and what it displaces, first review. Use existing context instead of interviewing field by field.
3. For a `repository`, record the repository location, its purpose, and whatever understanding is already known. No outcome or capacity decision is needed.
4. Preview the entry page, get approval, and write it. Do not create tickets in the same step; propose the smallest first ticket separately.

### Propagate from tickets

Trigger: a ticket checkpoint or completion, or a coordinator result, in a ticket that names this project.

Ask: does this change what Janus believes about the project? A ticket may reveal an architectural constraint, a new dependency, an invalid assumption, milestone progress, a new risk, a useful decision, or evidence that changes direction.

For a coordinator result, read all of it, not only its implications: an outcome can prove a milestone, verification can expose a constraint, and remaining concerns can be a risk. Extract the understanding and write it in Janus's words at the level of the project; do not paste the report. The result is evidence, not authority: record only what it supports, and verify a claim in the repository before it changes direction, a milestone, or a risk. A design decision the coordinator made within its authority is current understanding, not a `### Decisions` entry; that log holds the user's steering decisions.

- Understanding, risk, or dependency changes: update the project page directly, and append a dated decision when the user decided something.
- Milestone evidence proven by the ticket: record it; propose advancing the milestone.
- Evidence that the outcome, scope, or strategy is wrong: propose Replan.
- Nothing material: change nothing. Do not log routine progress on the project.

When the ticket names no project and the result teaches something durable about a repository Janus works in repeatedly, propose Create for a `repository` project.

Keep `### Active tickets` in sync with the board when tickets for this project are created, started, or closed.

### Review

Trigger: weekly planning, a milestone completing, a project blocked or idle for about a week, a new project competing for capacity, or the user asking.

1. Review only projects receiving or competing for capacity; for `repository` projects, review only whether understanding has gone stale.
2. Per initiative: actual position since last review, health with evidence, whether active tickets advance the current milestone, and one steering decision — continue, replan, pause, complete, or abandon.
3. Across projects: recommend the smallest active set that fits realistic capacity. Prefer pausing or abandoning stale projects over pretending they progress.
4. Present evidence separately from recommendation; preview changes; apply on approval. The project page itself is the record — do not write a separate review report.

### Replan

Trigger: evidence makes the current outcome, scope, milestone, strategy, lifecycle, or capacity materially wrong. Ordinary next-move changes belong to ticket checkpoints.

1. State the triggering evidence and what it invalidates.
2. Offer at most two viable plans, plus pause or abandon when warranted; recommend one.
3. On approval, update the project control block in place and append a dated decision: evidence, change, reason, capacity displaced, and reconsideration trigger when paused.
4. Reconcile affected tickets through the tickets skill; never mark them done without acceptance evidence.

### Close

Trigger: success evidence appears satisfied, or the user decides the initiative no longer deserves capacity. `repository` projects are `archived` instead when the repository stops mattering.

1. Classify: `completed` only when every success-evidence item maps to an artifact or observation; `abandoned` only by the user's explicit decision with a reason; otherwise not ready — recommend Review or Replan.
2. Every remaining non-closed ticket needs an explicit disposition: move elsewhere, wait, drop, or block closure.
3. Set status, replace health with the closure date, replace current understanding with the final result or abandonment reason, set `Next review: none`, and add a `## Closure` section with result, evidence, transferred work, and lessons worth keeping.
4. Never delete the page. Update HOME only if it presents this project as current focus.

## Output

Report naturally and briefly: the project by title, what changed, resulting status or health, and the next review point. Mention changed ticket states explicitly. Do not run project-wide tests for Markdown-only project updates.
