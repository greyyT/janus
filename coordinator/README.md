# Coordinator

The Janus coordinator: an omp (oh-my-pi) agent that plans, delegates, and reviews repository work through worker agents running in Herdr panes. omp lets each role use a different LLM provider.

Run omp from this directory so it discovers the coordinator skills in `.agents/skills/`.

## Skills

- `herdr-delegation`: spawn a predefined worker agent in a recorded Herdr pane and wait for its result. Variants and their models live in `scripts/registry.json`; role prompts live in `scripts/prompts/`.
- `plan-review-loop`: draft and independently review a repository plan through a researcher and planner.
- `implement-loop`: implement a planned task through independently reviewed TODOs.
- `task-review-loop`: review a task's aggregate change and route bounded fixes.
- `tasks`: the task format the workflows use: `.agents/tasks/<task>/` with `TASK.md`, `PLAN.md`, `TODOs.md`, and per-step records.
- `handoff`: continue the work in a fresh coordinator session instead of compacting.

## Requirements

- `omp` and `herdr` on `PATH`; the coordinator must run inside a Herdr pane.

## Tests

```sh
node --test .agents/skills/herdr-delegation/scripts/tests/
node .agents/skills/handoff/scripts/tests/handoff.test.mjs
```
