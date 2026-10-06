---
name: checkin
description: "Daily check-in: gather the last Dream PR, the past three days of work, the weekly reflection, unfinished tickets, and today's calendar, then give the user one short scannable briefing. Load when the user asks to check in or starts their day with Janus."
---

# Daily Check-in

The check-in gets the user ready to work in under a minute of reading. It reports what changed, what is unfinished, what needs their judgment, and what the day allows. It is not a status report, and it must not create new obligations.

**Test for every line:** would the user act differently, or have to go looking, without it? If not, cut it.

## Gather

Run these reads in parallel. Do not ask the user anything until you finish gathering.

1. **Dream PR.** Read the URL from `.janus/dream/pr`, then run `gh pr view <url> --json state,title,body,mergedAt`. If it is still open, it is waiting for the user. Extract only the following: changes that alter meaning (board moves, goal or project changes, new precedents), anything under "Noticed", and anything Dream was unsure about. If the file is missing or the PR is already merged with nothing new, skip this.
2. **The last three days of work.** Read the three most recent journals in `journal/YYYY-MM-DD.md` that are before today, whatever their dates. Use them to find which tickets were touched and what was left open.
3. **Weekly reflection.** Read `journal/weekly/<ISO-week>.md` for the current or previous week if the file exists. This workflow is deprecated, so skip it silently when no recent file exists. Never report that it is missing.
4. **Ticket status.** Read `tickets/BOARD.md`. Then read the checkpoint and the latest work-log entries of every ticket that is:
   - in Active or Verifying;
   - touched in the last three journals and not Done or Dropped;
   - in Waiting where the thing it waits on has now resolved.

   For each one, work out where it stopped, whether that stop needs the user (a pending decision, approval, or a stop at a gate), and its next move. Verify against the ticket file, not only the journal line. When the board disagrees with the ticket's own state, report that.
5. **Calendar.** Run `pnpm -s brain:calendar --date <today>`. Read `commands.md` first if you have not already in this session. Combine the busy blocks with the user's focus window and fixed commitments from the `<user-profile>` section and `brain/Working Model.md` to work out the real focus capacity left today, counted from the current time.
6. **Context.** Read the current focus and goal milestone in `brain/HOME.md`, and `brain/Working Model.md` for capacity beliefs.

## Report

Use this shape. Leave out any section with nothing worth saying. Do not write "None" placeholders. Write a ticket as its title followed by its ID.

```
**Check-in · <Weekday D Mon>** — <one-line read of the day: capacity + what matters>

**Needs you**
- <Ticket title · ID>: <the exact decision/approval>, <your recommended answer in ≤1 clause>

**Carrying over**
- <Ticket title · ID>: stopped at <where>; next: <next move>

**Dream** — <PR link>: <1–2 lines on meaning-changing edits; "safe to merge" or what to check>

**Today** — <busy blocks>; ~<N> focus Pomodoros left <window>

**Suggested focus:** <one default, why in one clause>

**Noticed** (max 2, only consequential: limit breaches, stale active work, goal displacement)
```

Rules:
- "Needs you" comes first and contains only items blocked on the user. Put a recommendation on each one, so the user can answer with one word.
- Cap "Carrying over" at about five lines. Merge tickets that stopped for the same reason.
- Do not repeat the PR body, journal lines, or anything the user said in this session.
- Give one suggested focus, not a menu. Weigh it against the HOME milestone and the remaining capacity. Do not choose by age.
- Judge limits only by the `tickets` skill: `autonomous` tickets never count toward the active limit. Do not use the limit text in the board footer.
- Raise goal displacement only when there is evidence, for example several days of work that never touched the HOME goal milestone, and say it once.
- Aim for about 15 lines in total.

## After the report

- If `journal/<today>.md` is missing, create it with only the `# <today>` heading. Do not copy the briefing into it.
- Change no ticket, board, or Dream state as part of the check-in. Fix mismatches only when the user decides, using the `tickets` skill.
- Mark items as shown in `.janus/orientation.json` only if the orientation extension's own format makes that obvious. Otherwise leave the file alone.
