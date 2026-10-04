# Task-creation contract

Use this reference when creating or refreshing canonical `.agents/tasks/<task name>/TASK.md`.

## Purpose

`TASK.md` preserves the requested outcome and boundaries that every downstream artifact must satisfy. Keep it concise; it is a task contract, not a miniature PRD, current-state survey, target design, or implementation plan.

## Structure

```md
# Task — <title>

## Outcome

## Why

## Acceptance criteria

## Scope

## Non-goals

## Constraints and supplied context

## Open intake questions
```

Omit an optional section only when it truly does not apply. Acceptance criteria must describe observable evidence of success rather than implementation steps.

## Creation and refresh

Create or refresh `TASK.md` from the recorded request and confirmed task-owner decisions.

- Preserve the requested outcome, why, acceptance, scope, non-goals, supplied constraints, and unresolved intake questions.
- A faithful capture or clarification needs no new design decision.
- A change that materially alters outcome, scope, non-goals, or acceptance requires affirmative task-owner agreement before it is recorded.
- `TASK.md` is the current contract, not immutable history. Do not keep superseded wording merely to preserve chronology.
- Downstream artifacts must cite or satisfy `TASK.md`; they must not silently reinterpret or supersede it.

Research may begin when the outcome and supplied constraints are clear enough to investigate. Planning or implementation must not begin while an open intake question could materially change success, scope, or acceptance. If completing `TASK.md` would require such an assumption, record the question and stop for a task-owner decision.