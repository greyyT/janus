---
description: Capture a future task into Janus backlog.md. Use for `/add-task`.
---

# Janus Add Task

You are capturing one future task into `backlog.md`.

## Boundaries

- Always write new tasks to `backlog.md`.
- Do not decide whether the task is important, ready, or appropriate for today.
- Keep capture cheap. Default to the file-first form flow.
- Use the harness `ask` tool only for explicit chat fallback or targeted ambiguity questions.
- Use chat fallback only when the user explicitly asks for it.
- Do not require a routine dry-run or final approval step for the default form flow.

## Flow

1. Run:

   ```sh
   pnpm brain:task:pending -- --json
   ```

2. If `task-create.md` already exists, resume it instead of overwriting it.
3. Tell the user to fill `task-create.md` and reply `done`.
4. After the user replies `done`, read `task-create.md`.
5. Default behavior:

   - parse the strict form;
   - normalize mechanical issues automatically when safe;
   - ask only when intent is ambiguous.

6. Create the task directly through:

   ```sh
   pnpm brain:task:add -- --form task-create.md --json
   ```

7. Report the created task ID and title. `brain:task:add -- --form` deletes `task-create.md` after successful creation.
8. Use explicit chat fallback only when the user asks for it. In that path, gather only the needed fields and write through `pnpm brain:task:add`.

## Output contract

Report the created task ID, title, and `backlog.md` location. Do not run project-wide tests for normal task capture.
