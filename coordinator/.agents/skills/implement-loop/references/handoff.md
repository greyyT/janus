# Implement-loop session handoff

This reference replaces **one coordinator omp session with one fresh coordinator omp session**; it does not spawn a task worker or grant authority by itself. Follow it only from an explicitly authorized named implement-loop run after a reviewed TODO closeout or a Janus-accepted integration-remediation checkpoint under `../SKILL.md`; an integration findings round need not yet be approved, but its accepted findings, amendment, next TODO, and owner gates must be explicit. **Automated mode** permits an eligible handoff under the verified task-scoped grant; **manual mode** permits one only after the user affirmatively approves the exact next action and that approval is recorded in the checkpoint. The source and destination working directory is the coordinator directory, even when implementation occurs in another repository.

## Verify before transfer

1. Reread `CLOSEOUT.md`, first-STEP authorization NOTES, the just-closed STEP and matching TODO when transferring after a TODO, the current ticket when applicable, and `REVIEW.md` when transferring an accepted integration-remediation checkpoint. Confirm named task, recorded automated/manual mode, closeout policy, review approval or accepted remediation checkpoint, commit/no-commit/PR result where applicable, next eligible action and no owner gate. In manual mode verify the recorded owner approval names that exact action; a checked box or handoff packet is insufficient. Do not transfer a blocked STEP, failed publication, or unresolved review dispute. If a retained integration reviewer is needed in the next session, record its actual agent name, pane ID, accepted finding list, and live status; do not close its pane.
2. Close completed worker and ordinary reviewer panes through the owning workflow before transferring. Keep only a correctly recorded retained integration reviewer when required. Verify `test "${HERDR_ENV:-}" = 1`, `test -n "${HERDR_PANE_ID:-}"`, and `pwd -P` is the Janus repository. Record `HERDR_PANE_ID` as source pane ID; never infer it from focus.
3. With `umask 077`, create one unique directory under `$TMPDIR` or an OS temp fallback and set it to mode `0700`. Write `handoff.md` mode `0600`, ordinarily under 800 words. Include: named task and absolute implementation repository/task directory; first-STEP authorization pointer; `CLOSEOUT.md` pointer (not a re-invented policy); exact most recent closed STEP/TODO with approval and commit/PR/no-commit evidence when applicable, or the accepted integration findings round and remediation-plan checkpoint; next eligible TODO or integration action; owner gates; ticket checkpoint; any relevant dirty/untracked attribution risk; retained reviewer identity when present; and at most three exact files to read first. No credentials, signed URLs, or unnecessary private data. For automated mode, state the **task-scoped continuation grant**. For manual mode, state only the **single-action continuation** The user approved, with its checkpoint evidence; do not grant later TODOs or handoffs. Tell the destination to revalidate mode, authority and exact next action against canonical files and source before any delegation. A generic packet grants neither.
4. Review the packet on disk before spawning. If its creation or review fails, preserve the source and report the blocker.

## One-hop transfer

Inspect layout and create exactly one visible sibling without stealing focus, from the recorded source pane, using Janus as CWD:

```bash
herdr pane layout --pane "$source_pane_id"
herdr pane split --pane "$source_pane_id" --direction <right|down> --cwd "$PWD" --no-focus
```

Record the returned destination pane ID. Start exactly one fresh Pi session there with a unique name:

```bash
herdr agent start <destination-name> --kind pi --pane <destination-pane-id>
```

Prompt it with **only the absolute packet path and short transfer instructions**: read that packet, initially read only its `read-files`, load the `implement-loop` skill's `SKILL.md` from Janus, verify the automated task-scoped grant or manual single-action approval against the canonical closed-step or accepted-remediation checkpoint, mode, policy, and next-action evidence, stop for the user if any check fails, and then perform only the authorized next action. Submit without `--wait`. Successful prompt submission is the transfer boundary; do not require an acknowledgment or wait for its first turn. If prompt submission fails, leave both panes alive and report exact identities and packet path; do not try a second destination.

After successful submission, print one concise transfer record with packet path, destination agent/pane and exact next action, then focus destination. If focus fails, keep source alive and report the blocker. Close **only** the recorded source pane as the final action; do not issue another command or post-close report. On unambiguous agent-start failure, close only the newly created empty destination pane; if start status is ambiguous, preserve it for inspection. Never stop Herdr or close an unrecorded resource. The packet remains for the destination; OS temp cleanup removes it later.
