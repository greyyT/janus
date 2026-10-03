# Projects

Projects are where Janus keeps its higher-level understanding of a body of work. Tickets track execution; projects track what that execution has taught. The operational rules agents follow live in `.agents/skills/projects/SKILL.md`.

## Why projects

Tickets are good at carrying the state of one piece of work, but they are deliberately narrow. Once a ticket closes, what it revealed — a constraint, a failed assumption, a decision — is buried in its work log. Without a place above tickets, every new ticket in the same area starts from scratch, and nobody can answer "where does this effort actually stand?" without reading every ticket.

A project page is that place. It holds the current understanding of an effort or codebase, so both people and agents can orient in one read.

## Two ways to use a project

The same structure serves two different purposes. Each project declares its `type`.

### Initiative

An initiative is a project in the sense of Tiago Forte's *Building a Second Brain*: a short-term effort with a clear outcome and an end. "Ship the v1 onboarding flow," "Migrate billing to the new provider," "Write the conference talk."

An initiative has:

- an outcome and observable success evidence;
- scope and explicit non-goals;
- a current milestone;
- health (`on_track`, `at_risk`, `blocked`);
- an ending: `completed` with evidence, or `abandoned` with a reason.

Use this when you want Janus to help steer something to completion and keep it within realistic capacity.

### Repository

A repository project is Janus's accumulated knowledge about a codebase it works in: architecture, conventions, constraints, past decisions, and pitfalls. It has no outcome and no end. It grows each time work in that repository teaches something, and it is archived when the repository stops mattering.

Use this when you want an agent to start work in a repository already knowing what previous sessions learned, instead of rediscovering it. The repository's own code and docs remain authoritative; the project page records what is useful to know before reading them and never duplicates repository-owned documentation.

## Files

```text
brain/projects/
└── <slug>/
    ├── <Human-readable Title>.md   # entry page
    └── ...                          # supporting notes, decisions, sketches
```

Projects have no numeric ID; they are referred to by title. The entry page has a `## Project control` block holding status, review dates, current understanding, risks, active tickets, and an append-only decision log. Initiatives add outcome, success evidence, scope, and the current milestone.

## How projects and tickets connect

```text
ticket work
    ↓
checkpoint or completion
    ↓
Does this change what we know about the project?
    │
   yes ──→ update the project page
    │
    no ──→ nothing to do
```

- **Tickets point up.** A ticket names its project. The project's `### Active tickets` lists the tickets currently in play, kept in sync with the board.
- **Tickets feed understanding.** When a ticket checkpoints or completes, Janus asks whether the work revealed something about the project: an architectural constraint, a new dependency, an invalid assumption, milestone progress, a new risk, a decision, or evidence that changes direction. If so, the project page is updated. Routine progress is not logged on the project.
- **Tickets prove milestones.** A ticket's acceptance evidence can be the evidence that an initiative's milestone is reached.
- **Projects steer tickets.** When an initiative is replanned, paused, or closed, the affected tickets are reconciled: kept, moved to waiting, or dropped with a reason.
- **Ownership stays separate.** Tickets own checkpoints, next moves, and session history. Projects own outcome, direction, and understanding. Neither copies the other.

Over time, a repository project becomes the briefing a new agent reads before its first ticket in that codebase, and an initiative's page becomes an honest picture of where the effort stands.

## Lifecycle

| Operation | When |
| --- | --- |
| **Create** | Starting an initiative, or beginning repeated work in a repository with no page. |
| **Propagate** | After ticket checkpoints and completions that change project understanding. |
| **Review** | Weekly planning, milestone completion, a stalled or blocked project, or a new project competing for capacity. |
| **Replan** | Evidence makes the outcome, scope, milestone, strategy, or capacity materially wrong. |
| **Close** | Success evidence is met, or the effort is deliberately abandoned. Repository projects are archived instead. |

Janus recognizes these moments from the conversation; there are no commands to remember.

## Who decides

Janus keeps understanding current on its own: summarizing state, updating current understanding and risks from ticket evidence, and syncing active tickets. It asks first before creating a project, changing an initiative's outcome, scope, or milestone, changing status or health, and closing, pausing, or archiving.
