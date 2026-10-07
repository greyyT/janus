---
name: checkin
description: "Daily check-in: gather the last Dream PR, recent work, unfinished tickets, active-goal commitments, and today's calendar; verify agreed goal blocks and give one short briefing. Load when the user asks to check in or starts their day with Janus."
---

# Daily Check-in

The check-in gets the user ready to work in under a minute of reading. It reports what changed, what is unfinished, what needs their judgment, and what the day allows. It is not a status report, and it must not create new obligations.

**Test for every line:** would the user act differently, or have to go looking, without it? If not, cut it.

## Gate: Dream PR first

The check-in must be read from a checkout that already includes the latest Dream PR. Before gathering anything:

1. Find open Dream PRs on `origin`: `gh pr list --state open --search "head:dream/" --json number,title,url,headRefName`. Do not rely on `.janus/dream/pr` alone, because it can point to an older PR.
2. **If any are open, stop.** Do not gather and do not report. Give the user each PR's link and title, ask them to review and merge or close it, and say to come back for the check-in afterwards. Output nothing else.
3. Once the user replies after resolving it, or if no Dream PR was open in step 1, run `git pull --rebase --autostash origin main`. Resolve conflicts with upstream as the base and re-apply the local edits on top. If a conflict changes the meaning of a record, ask the user before resolving it. If a Dream PR is still open, repeat step 2.
4. Only then gather.

## Gather

Run these reads in parallel. Do not ask the user anything until you finish gathering.

1. **Dream PR.** Take the most recently merged Dream PR (`gh pr list --state merged --search "head:dream/" --limit 1 --json number,url,body,mergedAt`). Extract only the following: changes that alter meaning (board moves, goal or project changes, new precedents), anything under "Noticed", and anything Dream was unsure about. If you already reported that PR in an earlier check-in, skip this.
2. **The last three days of work.** Read the three most recent journals in `journal/YYYY-MM-DD.md` that are before today, whatever their dates. Use them to find which tickets were touched and what was left open.
3. **Weekly reflection.** Read `journal/weekly/<ISO-week>.md` for the current or previous week if the file exists. This workflow is deprecated, so skip it silently when no recent file exists. Never report that it is missing.
4. **Ticket status.** Read `tickets/BOARD.md`. Then read the checkpoint and the latest work-log entries of every ticket that is:
   - in Active or Verifying;
   - touched in the last three journals and not Done or Dropped;
   - in Waiting where the thing it waits on has now resolved.

   For each one, work out where it stopped, whether that stop needs the user (a pending decision, approval, or a stop at a gate), and its next move. Verify against the ticket file, not only the journal line. When the board disagrees with the ticket's own state, report that.
5. **Calendar.** Run `pnpm -s brain:calendar --date <today>`. Read `commands.md` first if you have not already in this session. Combine the busy blocks with the user's focus window and fixed commitments from the `<user-profile>` section and `brain/Working Model.md` to work out the real focus capacity left today, counted from the current time.
6. **Context.** Read the current focus and goal milestone in `brain/HOME.md`, and `brain/Working Model.md` for capacity beliefs.
7. **Goal commitments.** Read `.agents/skills/goal/SKILL.md` fully. Discover canonical active goal files and non-closed tickets linked to them, including Ready tickets not touched in recent journals. Inspect their `## Goal commitment` sections and supporting work-log evidence. Read the relevant goal records and `brain/Precedents.md`. Do not infer commitments from a ticket's age, goal metadata, or suggested focus.

## Verify goal commitments

After gathering, run the goal skill's Verify daily and, when applicable, Handle postponement procedures. Compare elapsed agreed blocks with recorded evidence. Missing results stay unknown; ask one focused question if needed. Record confirmed results and distinct postponements in the owning ticket, not the journal or a second counter. Show the verified count and today's agreed output/block. At three eligible postponements, apply the current P-001 rule; exceptions are recorded and replanned rather than scolded.

If an active goal has no agreed commitment, surface that gap and recommend the smallest commitment decision. Do not schedule work, establish a commitment, or change the goal without approval. No historical strikes are invented, and a reschedule does not erase confirmed misses. If a result or replan needs the user's answer, finish that loop when they reply using the goal/tickets/decisions skills.

## Report

Use this shape. Leave out any section with nothing worth saying. Do not write "None" placeholders. Write a ticket as its title followed by its ID.

```
**Check-in · <Weekday D Mon>** — <one-line read of the day: capacity + what matters>

**Needs you**
- <Ticket title · ID>: <the exact decision/approval>, <your recommended answer in ≤1 clause>

**Carrying over**
- <Ticket title · ID>: stopped at <where>; next: <next move>

**Dream** — <PR link>: <1–2 lines on meaning-changing edits that just landed>

**Today** — <busy blocks>; ~<N> focus Pomodoros left <window>

**Goal commitment** — <Ticket title · ID>: <agreed output and today's block, or result needing confirmation>; <N>/3 verified postponements

**Suggested focus:** <one default, why in one clause>

**Noticed** (max 2, only consequential: limit breaches, stale active work, goal displacement)
```

Rules:
- "Needs you" comes first and contains only items blocked on the user. Put a recommendation on each one, so the user can answer with one word.
- Cap "Carrying over" at about five lines. Merge tickets that stopped for the same reason.
- Do not repeat the PR body, journal lines, or anything the user said in this session.
- Give one suggested focus, not a menu. Weigh it against the HOME milestone and the remaining capacity. Do not choose by age.
- Judge limits only by the `tickets` skill: `autonomous` tickets never count toward the active limit. Do not use the limit text in the board footer.
- Raise goal displacement only from evidence. Distinguish general drift from verified postponements of agreed blocks; only the latter count toward P-001. Do not duplicate the commitment assessment under Noticed.
- When an active goal has no agreed commitment, use the Goal commitment line to say so and recommend a decision; do not show an invented zero count or block.
- Aim for about 15 lines in ordinary briefings. Missing-result clarification or required threshold escalation must not be suppressed to meet that limit.

## After the report

- If `journal/<today>.md` is missing, create it with only the `# <today>` heading. Do not copy the briefing into it.
- Goal verification may update ticket commitment checkpoints and append confirmed result/postponement evidence through the goal and tickets skills. Do not change board or Dream state, invent progress, or mark a whole ticket done as part of the briefing. New commitments, replacement blocks and plan changes require agreement; other state mismatches still go to the user through tickets.
- Mark items as shown in `.janus/orientation.json` only if the orientation extension's own format makes that obvious. Otherwise leave the file alone.
