# Tickets

Tickets are how Janus manages work that spans more than one sitting. This document explains why the system exists and how it works. The operational rules agents follow live in `.agents/skills/tickets/SKILL.md`.

## Why tickets

Janus started with a plain task system: one-line task blocks in `backlog.md`, moved into the day's journal when committed. It was simple, and it failed in a specific way. A task recorded *what* to do, but not *where the work stood*. After a break, a context switch, or a new agent session, the state of the work lived only in someone's head or in a scrolled-away conversation. Every resume started with re-explaining: what was tried, what was decided, what is blocking, what comes next.

The ticket system began as an experiment, proposed in a conversation with ChatGPT, to fix that one problem: make every unit of work carry enough state to be resumed cold. Over time it proved its value:

- **Agents pick up work immediately.** A fresh agent reads the ticket and knows the outcome, the latest checkpoint, and the exact next move. No re-briefing.
- **Progress survives interruptions.** Checkpoints are written when a session ends, so context is captured while it is still fresh rather than reconstructed later.
- **"Done" means verified.** Each ticket states observable acceptance evidence, so finishing construction is not mistaken for finishing the work.
- **Decisions stay traceable.** The work log keeps what changed and why, without cluttering the current state.
- **Work-in-progress stays bounded.** Limits on ready and active tickets keep the queue honest about capacity.

The backlog still exists for lightweight actions that need no continuity. Tickets are for work that does.

## What a ticket is

A ticket is one deliverable, decision, investigation result, or verification result, normally finishable in one to four focused sessions. Anything larger belongs to a project and should be split; anything smaller belongs in the backlog or calendar.

## Files

```text
tickets/
├── BOARD.md                     # canonical workflow state
└── J-NNN-<slug>.md              # one file per ticket
```

- `BOARD.md` lists every ticket exactly once under its state section.
- Each ticket file owns its contract, current checkpoint, acceptance evidence, and work log.
- The day's journal only references ticket sessions; it never copies ticket content.

## The ticket contract

| Field | Purpose |
| --- | --- |
| `project`, `goal` | What the ticket serves, or `none`. |
| `why` | Why it deserves capacity. |
| `outcome` | The one coherent result. |
| `done_when` | Observable completion, including verification. |
| `next_move` | The exact action that starts work now. |
| `blocked_by` | The blocker, or `none`. |
| `## Current checkpoint` | Only the latest resumable state. |
| `## Acceptance` | Checklist, checked only on evidence. |
| `## Work log` | Dated, append-only history. |

The checkpoint is replaced on each update; history goes to the work log. A ticket should always read as "here is where things stand," not as a pile of past states.

## States

| State | Meaning |
| --- | --- |
| `ready` | Worthwhile and actionable. At most five. |
| `active` | Being worked. At most two that need the user's attention. |
| `waiting` | Blocked on an explicit event, person, or ticket, with a review condition. |
| `verifying` | A result exists; acceptance evidence is incomplete. |
| `done` | Outcome and acceptance evidence satisfied. |
| `dropped` | Deliberately abandoned, with a reason. |

## Lifecycle

Janus recognizes each phase from the conversation; there are no commands to remember.

1. **Capture.** New work is classified first (calendar, backlog, idea inbox, or ticket), checked for overlap, and written as `ready` or `waiting`. Capture never starts work.
2. **Start.** The ticket moves to `active` and Janus gives a short briefing: what matters now, relevant prior decisions, and the exact first action.
3. **Checkpoint.** When a session ends, a result or blocker appears, or work switches elsewhere, Janus records what changed, the next move, and the resulting state.
4. **Replan.** When urgency or discovery displaces planned work, Janus records what was displaced, why, the replacement, a cap, and the return point.

## Who decides

Janus handles routine upkeep on its own: briefings, starting work, checkpoints, and evidence-backed state changes. It asks first before creating a ticket it had to infer, marking anything `done` or `dropped`, displacing the day's protected work, exceeding limits, or reopening closed work.
