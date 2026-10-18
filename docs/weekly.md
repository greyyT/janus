# Weekly review

The weekly review looks at the ISO week that just ended as a whole: outcomes, tickets, displacement, goals, reading, and what next week can hold. It runs on its own and hands everything to the user as one pull request, like Dream. The user reads the PR, then goes through it with Janus, following `## Discussing the PR` in `tools/weekly/prompt.md`. Merging is approval.

The instructions for the run are `tools/weekly/prompt.md`. This document explains the setup around it.

## When it runs

- **Monday 04:00 local, by launchd**, an hour after Dream has dreamed Sunday. `pnpm weekly:install` installs the job.
- **Catch-up before the next prompt.** `.pi/extensions/weekly` runs `tools/weekly/weekly.sh catch-up` before each of the user's prompts. It returns at once when nothing is due. Otherwise the review runs in the background.
- **Only the latest week.** A week is due once it is past Monday 04:00 and `.janus/weekly/last` is older. Missed older weeks are skipped. A stale review is not worth the attention.
- It waits while Dream is running, and exits quietly when offline.

## Inputs

`pnpm weekly:input` gathers one Markdown file:

| Input | What it is |
| --- | --- |
| Journals | The seven daily journals of the week, from `origin/main` |
| Dream PRs | Every dream PR of the week, with its body. An open one is not on `main` yet |
| Commits | `git log` of `origin/main` during the week |
| Sessions | The Janus sessions of the week, by path. Dream already digested them |
| Previous review | The body of the last weekly PR |
| Calendar | The next seven days |

The run then reads the live records itself: HOME, the board and tickets, goals, managed books, projects, and the working model.

## How a run works

Unlike Dream, it moves nothing out of the main checkout. It works on a worktree of `origin/main` on `weekly/YYYY-Www`, runs `pi -p --no-session` with the prompt, commits `weekly: YYYY-Www`, pushes, and opens the PR. The worktree and local branch are removed afterwards.

## What it changes

Three levels, so nothing that needs the user happens without them:

1. **Written:** the weekly record `journal/weekly/YYYY-Www.md`, and factual corrections where a record contradicts stronger evidence. Listed under **Changes**.
2. **Proposed on the branch:** changes a skill would preview, such as a goal's plan or dropping a stale ticket. Listed under **Needs your judgment**. Merging accepts them, closing the PR rejects them.
3. **Suggested only:** next week's outcomes, commitments, new tickets, calendar blocks. Nothing is written. Listed under **To discuss**, each with a recommendation. They are settled in conversation.

## Trying a prompt

Keep a variant in `.janus/weekly/prompts/` (gitignored) and run `pnpm weekly --dry-run --prompt .janus/weekly/prompts/<name>.md`. A dry run writes `input.md`, `pr-body.md`, and `weekly.diff` under `.janus/weekly/dry-run/` and touches nothing else.

## Authority

The run acts under `Weekly review commits and opens its PR` in `brain/Grants.md`. It never merges or pushes to `main`.

## Failures

A failure is written to `.janus/weekly/failed` and shown before the user's next prompt. Details are in `.janus/weekly/weekly.log`. If the push succeeded but the PR did not open, the message gives the `gh` command to finish.
