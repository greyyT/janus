---
name: handoff
description: "Hand off the work to a fresh session with selected context, rather than compacting the current session."
---

# Session Handoff

Transfer the current work from this Pi session to one fresh Pi session while protecting the destination's fresh context window. Persist the minimum sufficient resume context, send the destination to that artifact, and retire the source after Herdr accepts the prompt.

If a next-session focus is supplied, use it to narrow the current objective without adding scope. Otherwise, preserve the current objective and exact next action.

Replace the current session with exactly one fresh session.

## Prepare selected context

1. Read `references/handoff-template.md` relative to this skill directory.
2. Write a resume packet to a temporary Markdown file using the template and the drafting instructions below.
3. Review the packet before transfer:
   - the objective, current state, and exact next action are understandable without the source conversation;
   - existing specifications, plans, ADRs, issues, commits, diffs, and durable notes are referenced rather than copied;
   - `<read-files>` contains at most three exact files required at the beginning—no directories, globs, or speculative reading;
   - `<modified-files>` contains only files relevant to this work and does not instruct the destination to read all of them;
   - suggested skills are installed and relevant to the next action;
   - no credentials, authentication material, signed URLs, private keys, environment values, or unnecessary sensitive personal or customer information appear.

Preserve paths, issue IDs, branch names, decision owners, and other identifiers when genuinely required to resume. For a secret, name its secure source or the command that retrieves it without reproducing the value.

If writing or reviewing the packet fails, report the blocker and stop without running the script.

### How to write the handoff

Write for a fresh session that has not seen this conversation. Select context that changes its next decision or action; omit everything else.

1. **Lead with the outcome.** State what the user wants accomplished and what remains. If the user supplied a next-session focus, make that the immediate scope without expanding the original objective.
2. **Describe the actual checkpoint.** Separate completed, in-progress, and blocked work. Cite verification commands and observed results; distinguish implemented from verified. Include a failed check or unfinished operation when it affects continuation.
3. **Carry forward constraints and decisions.** Preserve relevant user instructions, accepted tradeoffs, non-goals, and decisions the destination might otherwise reverse. Do not treat an unresolved choice as settled.
4. **Give one executable next action.** Name the exact file, command, edit, or question to tackle first, plus the observable stop condition. Add at most two justified follow-ups; avoid vague instructions such as “continue implementation.”
5. **Choose the smallest initial read set.** Put at most three exact files in `<read-files>`, selected because they are needed for that first action. Reference other specifications, plans, evidence, and durable notes where relevant without copying them or requiring immediate reading.
6. **Inventory relevant changes and live resources.** List work-relevant changed files in `<modified-files>`. Record any retained agent, pane, process, or temporary artifact needed to resume, with its exact identity, state, and ownership. Do not infer identities from memory or layout.
7. **Remove conversation residue.** Omit chronological narration, superseded approaches, repeated explanations, and unrelated context. Mark uncertainty explicitly and use `None` for empty template sections.

Before transfer, ask: could the destination perform the immediate action without reconstructing this conversation, and is every included detail necessary for correct continuation?

## Run the handoff

After reviewing the packet, choose a descriptive session name based on the work being continued, such as `Review task handoff`. Pass it to the script; do not omit it or ask the user to name the session. The script starts Pi with `--name` and generates the separate Herdr agent identifier internally.

Invoke the script once using its absolute path (resolve `scripts/handoff` relative to this skill directory):

```bash
node <absolute-skill-directory>/scripts/handoff <absolute-handoff-path> "<session-name>"
```

The script handles environment validation, source-pane capture, private temporary-packet staging, and the entire Herdr lifecycle. It starts one fresh Pi session to the **right** in the current working directory, submits the staged packet path without waiting for a destination turn, prints a transfer record, focuses the destination, and closes only the source pane.

Do not perform these commands yourself, retry the script automatically, or run another tool after successful transfer. The source pane closes during the script.

## Failure behavior and ownership

- On failure, report the script's output and stop. Do not retry automatically or create another destination.
- Transfer or focus failure keeps the source alive and leaves any created destination available for inspection.
- If source closure fails, the destination already has the packet. Do not re-submit.
- Keep the staged packet available for the destination; OS temporary cleanup owns eventual removal.
