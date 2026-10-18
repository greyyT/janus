---
name: weekly-review
description: Go through the open weekly PR with Greyy. The weekly review runs on its own every Monday at 04:00 and opens a `weekly/*` PR (`docs/weekly.md`). Load when Greyy reads, questions, or answers a weekly PR, asks about last week, or check-in finds an open weekly PR.
---

# Janus Weekly Review

The review itself is automatic: `tools/weekly/weekly.sh` writes it and opens the PR. This skill is the conversation after Greyy reads it. Merging the PR is his approval of everything written on the branch.

## Read first

1. The open weekly PR: `gh pr list --state open --search "head:weekly/" --json number,url,headRefName,body`. If none is open, say so and stop; offer `pnpm weekly --dry-run` only when he wants a review now.
2. Its diff: `gh pr diff <number>`.
3. The live state each topic touches: `tickets/BOARD.md` and the tickets, the goal, book, or project page. The PR was written Monday at 04:00; things may have moved since.

## Conversation

Go topic by topic, in the PR's order: **To discuss**, then **Needs your judgment**. Lead with the PR's recommendation. Let him answer naturally. Do not re-explain the PR.

- **Next week's outcomes.** Agree each one, or fewer. Goal- or book-linked ones go through the `goal` or `book` skill's Commit and schedule: output, blocks, first action, stopping point, displaced activity. Record agreed commitments in the owning ticket or book. Calendar writes and new tickets follow their own skills and approval.
- **Other suggestions.** Apply what he agrees to through the skill that owns the record. Record his answers with the `decisions` skill.
- **Proposals on the branch.** If he accepts as written, nothing to do. If he rejects or rewords one, the branch must change before merging (below).
- **Corrections to the review.** If he disputes a fact or conclusion, check the evidence. Fix it when he is right. Keep an evidence-backed disagreement and say why, once.

## Changing the branch

Edit the weekly branch only through a worktree, never the main checkout:

```sh
git fetch origin && git worktree add /tmp/janus-weekly-edit origin/<branch>
```

Edit there, then commit and push to `<branch>`, and update the PR body (`gh pr edit <number> --body-file <file>`) so it matches the branch. Remove the worktree afterwards. Committing, pushing, and editing the PR are grant-gated. Check `brain/Grants.md`, and ask when no grant covers it.

Changes agreed in conversation that belong on `main`, such as commitments recorded in tickets, are ordinary Janus edits in the main checkout. Dream picks them up that night.

## Close

End with: what was agreed, what changed on the branch, and whether the PR is ready to merge. Merging is his call. Never merge it.
