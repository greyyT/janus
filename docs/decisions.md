# Decisions and authority

Janus coordinates work so the user is asked only when their judgment is needed. That depends on two things: remembering how the user decides, and knowing what Janus and its coordinators are allowed to do. This document explains how both work. The procedures for changing them live in `.agents/skills/decisions/SKILL.md`; how they apply lives in the authority rule in `AGENTS.md` and in coordinate mode.

## Why

Without memory, every coordinator question that is not obviously routine goes to the user, including questions the user has answered before. Decisions get buried in ticket work logs between status updates, so nothing finds them the next time.

Without explicit authority, "the user would probably want this" quietly becomes "Janus is allowed to do this". Knowing what the user would choose and being allowed to act on it are different questions.

## Three layers

| Layer | Question | Home |
| --- | --- | --- |
| Direction | Where is the project going? | The project's `### Decisions` and decision notes |
| Precedent | How is this kind of question usually decided? | `brain/Precedents.md` |
| Grant | Is this action currently authorized? | The ticket's `## Grants` for one piece of work; `brain/Grants.md` for projects and everything |

**Grants control authority. Precedents encode reusable judgment. Direction encodes project intent.** None of them substitutes for another: a precedent can say opening the PR is the usual choice, direction can say it fits the project, and still only a grant makes opening it allowed.

Under all three lies decision evidence: `Decision (user): question → choice, because …` lines in ticket work logs, or in the journal when no ticket owns the decision.

## How a coordinator question is resolved

```text
accepted precedent applies? ─┐
otherwise routine judgment ──┼─→ consistent with direction? ─ no → ask the user
                             │                              yes ↓
otherwise ask the user       │                          chosen action
                                                              ↓
                                     ordinary in-scope work? ─ yes → do it
                                                              no ↓
                                    applicable grant allows it and none excludes it?
                                                    yes → do it · no → ask the user
```

Routine judgment means the choice stays inside the agreed outcome and scope and nothing Janus knows contradicts it. It is Janus's own call, recorded as such, not a precedent.

## Grants

- **The execution request authorizes the work.** Reading, editing, testing, and local verification inside the request's scope need no grant. Grants extend authority across specific protected boundaries: commits, pushes, PRs, merges, external replies, deletions, deploys, live external calls, and automated multi-step loops. The list lives in `brain/Grants.md`.
- **Deny by default.** A grant-gated action with no applicable grant is not allowed; Janus asks.
- **Exclusions win.** An action is authorized only when an applicable grant allows it and no applicable grant excludes it. A prohibition is a grant that allows nothing and excludes the action.
- **Scopes.** `work` (one ticket), `project`, and `global`, with optional `uses` for bounded permissions such as "one more rerun". Repository scope is deferred because current cases can be represented unambiguously by project grants, using repository project pages. Add it only when that stops being true; repository and project are not the same boundary.
- **Coordinators receive only the result.** Janus resolves the applicable grants and sends the allowed actions in the execution request. The coordinator does not need to know where they came from, and any record it keeps in the target repository is a copy, not a source of authority. Revoking a grant is sent to every running coordinator that received it.

## Precedents

A precedent records a conditional choice: when these conditions hold, choose this, unless these exceptions apply, because of this reason, as shown by this evidence. It never records a preference like "the user likes X".

Precedents are learned, never assumed:

1. Every decision the user makes is logged as a decision line.
2. When a new decision arrives, Janus searches earlier decision lines for the same underlying situation. Two matching choices are a reason to propose a precedent, not proof of one.
3. Janus proposes the exact wording; the user approves it, corrects it, or declines. A refusal is logged too, so the same rule is not proposed again.
4. If the user states a rule directly ("whenever X, choose Y"), Janus proposes it for immediate acceptance.

There is no candidate store: candidates are found by searching the decision lines. Everything active in `brain/Precedents.md` is therefore approved, and Janus may apply it whenever its conditions match. When the user overrides a precedent, it gains an exception or is retired; retired precedents stay as history.

## Who decides

Janus records decisions, proposes precedents, and narrows or revokes grants on request without asking. It asks before writing, refining, or retiring a precedent, and before creating or widening a grant when it had to infer any part of it. It never writes a grant or precedent the user did not express.
