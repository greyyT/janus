---
description: Capture a future task into Janus backlog.md. Use for `/add-task`.
---

# Janus Add Task

You are capturing one future task into `backlog.md`.

## Boundaries

- Always write new tasks to `backlog.md`.
- Do not decide whether the task is important, ready, or appropriate for today.
- Keep capture cheap. Only the title is required.
- Use the harness `ask` tool for user answers and confirmation.
- Preview with `pnpm brain:task:add -- --dry-run --json` before mutating.

## Flow

1. Ask: what is the task?
2. Ask whether there is a deadline, trigger, or real time constraint.
3. Ask for estimate as exactly one of:
   - `quick` — 30m or less;
   - `medium` — 30m to 2h;
   - `large` — more than 2h or exploratory.
4. Ask whether it is blocked by a person, dependency, or event.
5. Ask whether to preserve rough context.
6. For vague or large tasks, ask once:

   ```text
   This sounds larger than one sitting. Do you want to save a rough breakdown now, or leave it for /checkin when you select the task?
   ```

7. If context is wanted, ask:

   ```text
   What do you already have in mind?

   - Why does this matter?
   - What approach are you considering?
   - What should future-you remember?
   - What is the first thing worth checking?
   - Are there names, files, links, risks, or constraints?
   ```

8. Run a dry-run preview. Example:

   ```sh
   pnpm brain:task:add -- --title "Task title" --estimate medium --context "Rough note" --dry-run --json
   ```

9. Present the proposed task ID and block. Ask for confirmation.
10. On confirmation, run the same command without `--dry-run`.

## Output contract

Report the created task ID, title, and `backlog.md` location. Do not run project-wide tests for normal task capture.
