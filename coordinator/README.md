# Coordinator

The Janus coordinator: a pi agent that plans, delegates, and reviews repository work through worker agents running in Herdr panes.

Run `pi` from this directory. The project harness keeps it minimal:

- `.pi/settings.json` enables six built-in tools (`read`, `grep`, `find`, `write`, `edit`, `bash`) and turns off pi's built-in MCP, codemode, tool-search, and llama.cpp extensions.
- `.pi/extensions/harness` keeps only those six tools active and blocks calls to any other tool, including tools registered by other extensions. It also loads only skills and context files inside this directory, so the enclosing repository's and the user's skills and `AGENTS.md` stay out of the system prompt. Pi has no sub-agent tool; the coordinator spawns agents through `herdr-delegation`.
- `.pi/SYSTEM.md` replaces pi's default system prompt. It defines the coordinator's role: drive one execution request in one target repository to a verified result, mostly by coordinating worker agents, deciding routine engineering questions itself and escalating outcome changes as concrete decisions.

Pi loads project files after you trust the project on first run.

## Skills

- `herdr-delegation`: spawn a predefined worker agent in a recorded Herdr pane and wait for its result. Variants and their models live in `scripts/registry.json`; role prompts live in `scripts/prompts/`.
- `plan-review-loop`: draft and independently review a repository plan through a researcher and planner.
- `implement-loop`: implement a planned task through independently reviewed TODOs.
- `task-review-loop`: review a task's aggregate change and route bounded fixes.
- `tasks`: the task format the workflows use: `.agents/tasks/<task>/` with `TASK.md`, `PLAN.md`, `TODOs.md`, and per-step records.
- `handoff`: continue the work in a fresh coordinator session instead of compacting.

## Requirements

- `pi` and `herdr` on `PATH`; the coordinator must run inside a Herdr pane.

## Tests

```sh
node --test .agents/skills/herdr-delegation/scripts/tests/
node .agents/skills/handoff/scripts/tests/handoff.test.mjs
```
