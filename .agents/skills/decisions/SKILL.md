---
name: decisions
description: How Janus records the user's decisions, learns precedents from them, and creates, changes, and revokes grants. Load whenever the user answers a decision Janus brought to them; states or changes a reusable rule, standing permission, explicit prohibition, or "from now on" behavior; or approves, declines, or overrides a precedent or grant.
---

# Janus Decisions

This skill changes decision memory and authority. How existing precedents and grants are applied lives elsewhere: the authority rule in `AGENTS.md`, and result triage in coordinate mode. Do not restate those rules here or act on them from here.

## Model

| Layer | Question | Canonical home |
| --- | --- | --- |
| Decision evidence | What did the user decide, and why? | `Decision (user):` lines in the ticket work log, or today's journal when no ticket owns it |
| Direction | Where is the project going? | The project's `### Decisions` and decision notes, through the projects skill |
| Precedent | How is this kind of question usually decided? | `brain/Precedents.md`, accepted entries only |
| Grant | Is this action currently authorized? | `work`: the ticket's `## Grants`; `project` and `global`: `brain/Grants.md` |

There is no candidate store. Candidates are found by searching decision lines when a new decision arrives.

Decision line formats:

```md
- YYYY-MM-DD: Decision (user): <question> → <choice>. Because: <reason, if given>.
- YYYY-MM-DD: Decision (user): not a precedent — <proposed rule> — <reason>.
- YYYY-MM-DD: Decision (Janus, per P-NNN): <question> → <choice>.
- YYYY-MM-DD: Decision (Janus, routine): <question> → <choice>. Because: <reason>.
```

Render precedents and grants by title followed by ID, as tickets are: `Narrow residual finding after the correction cap (P-003)`.

## Authority

Janus acts without asking for:

- recording decision lines that reflect what the user said;
- searching decision evidence and proposing a precedent;
- narrowing or revoking a grant the user asked to narrow or revoke;
- recording that a grant expired or ran out of uses.

Janus proposes and waits for the user's approval before:

- writing, refining, or retiring a precedent;
- creating or widening a grant when Janus inferred any of its scope, allows, excludes, uses, or expiry.

Never write a grant or precedent the user did not express. Never mark a precedent accepted on repetition alone.

## Procedures

### Record a decision

Trigger: the user answers an escalation, approves or declines a proposal, or chooses between options.

1. Append one `Decision (user):` line to the owning ticket's work log, or to today's journal under `## Notes` when no ticket owns it.
2. Classify what else the decision does; it may do more than one:
   - changes the project's outcome, scope, or strategy → Direction, through the projects skill;
   - creates, widens, narrows, or withdraws permission → Create or widen a grant, or Narrow or revoke a grant;
   - could recur beyond this work → Check for a precedent;
   - otherwise it stays local evidence. Choices that only matter inside one piece of work never become precedents.

### Check for a precedent

Trigger: a recorded decision could recur, or the user states a general rule ("whenever X, choose Y").

1. When the user stated the rule explicitly, go to Propose.
2. Search `Decision (user):` lines across `tickets/` and `journal/`, and read `brain/Precedents.md`.
3. For each candidate match, read its surrounding context. A match is the same underlying situation: the same kind of question, decided under the same conditions that drove the choice. A similar choice in a different situation is not a match.
4. Then:
   - an earlier matching decision made the same choice → Propose;
   - a matching `not a precedent` line exists → do not propose, unless the context now differs in a way that line did not consider;
   - an active precedent matched and the user chose differently → Refine or retire;
   - otherwise do nothing.

### Propose

1. Draft the exact `scope`, `when`, `choose`, `unless`, and `because`, with links to every decision used as evidence. The conditions are where a precedent goes wrong; make each one checkable.
2. Append the proposal as one short paragraph to the end of the next reply. It must not interrupt the user's current question or block the work.
3. On approval of the wording (corrections included), allocate the next `P-NNN` from `brain/Precedents.md`, write the entry under `## Active` with `approved:` today, and log it as a decision line.
4. On refusal, log a `not a precedent` line with the reason. Unanswered proposals stay unwritten; do not repeat them in the same session.
5. In a dream run, the dream PR is the proposal: Dream writes the exact entry on its branch with `approved: by merging dream PR <branch>` and lists it for the user's judgment. The entry stays unapproved until the user merges the PR; closing it rejects it. Never record approval as already given (`tools/dream/prompt.md`).

### Refine or retire

Trigger: the user overrides a choice Janus made under a precedent, or decides differently where an active precedent matched.

1. Propose either an added `unless` that explains the difference, or retirement.
2. On approval, edit the entry in place for a refinement, or move it under `## Retired` with `- retired: YYYY-MM-DD — reason`. Never delete a precedent.
3. Log the decision line in both cases.

### Create or widen a grant

Trigger: the user grants permission for a grant-gated action ("from now on…", "you may…", "for this ticket…"), or states a prohibition ("never…", "always ask before…").

1. Resolve the fields from the user's words:
   - scope: `work` when it concerns one ticket, `project` when it names a project or a repository with a project page, otherwise `global`;
   - `allows`, or `none` for a prohibition;
   - `excludes`, including anything the user carved out;
   - `uses`: a number only when the user bounded it ("once", "one more rerun");
   - `expires`: a date, `ticket close` for `work` grants, or `until revoked`.
2. Preview the grant in one or two lines when Janus inferred any field; write directly when the user supplied every field.
3. Write `work` grants to the ticket's `## Grants`, and `project` and `global` grants to `brain/Grants.md` under `## Active` with the next `G-NNN`. Log the decision line.
4. Repository scope is deferred: when a repository-specific permission has no project page that represents it unambiguously, say so and ask where it belongs instead of guessing.

### Narrow or revoke a grant

Trigger: the user withdraws or limits a permission, a grant expires, or its uses run out.

1. Narrowing changes the entry in place. Revoking moves it under `## Revoked` with `- revoked: YYYY-MM-DD — reason`; for `work` grants, mark the ticket entry revoked. Never delete a grant.
2. Find every running coordinator that received the grant: ticket checkpoints record which grants each request carried. In coordinate mode, send each one the change with `send_to_coordinator`; it applies from the next safe boundary. Coordinators that are not running receive the change through their next request.
3. Log the decision line.

## Output

Report briefly: what was recorded, written, or proposed, by title and ID. Decision lines are silent housekeeping; mention them only when they change something the user will see.
