# Handoff packet template

Follow this section order. Replace every bracketed instruction. Use `None` when a section has no applicable content rather than inventing detail.

```md
# Handoff — [objective in ten words or fewer]

- created: [UTC ISO-8601 timestamp]
- working-directory: [absolute current working directory]

> This document transfers active work from an existing session to a fresh Pi
> session. The fresh context window is an asset: do not reconstruct the source
> conversation, preload broad project context, or read every referenced file.
> Begin with only the files in `<read-files>` and expand context when the work
> itself requires it.

## Goal

[State the outcome the user is trying to accomplish. If the user supplied a destination
focus, state it as the immediate scope of this session.]

## Constraints & Preferences

- [A requirement, preference, non-goal, or safety boundary that changes execution.]
- [No more than seven bullets.]

## Progress

### Done

- [x] [Completed result — cite its evidence or authoritative artifact.]

### In Progress

- [ ] [Current work and its precise state.]

### Blocked

- [Concrete blocker and what would resolve it, or `None`.]

## Key Decisions

- **[Decision]**: [One-line rationale.] Reference: `[path, URL, issue, commit, or ADR]`.

[Include only decisions the destination might otherwise reverse or re-litigate.
Do not reproduce an existing decision record.]

## Next Steps

1. **Immediate action:** [One exact physical action the destination can perform without reconstructing context.]
2. [At most two already-justified follow-up actions.]
3. **Stop when:** [Smallest observable boundary that materially advances the work.]

## Suggested Skills

- `[installed skill name]` — [Why it is relevant and the trigger for using it.] [Either `Destination may load when triggered` or `the user must invoke explicitly`.]

[Suggest no more than three installed skills. Reference the governing workflow
when continuation depends on its recorded authorization; the packet itself
does not authorize further delegation or handoffs.]

## Critical Context

- [A concise fact, gotcha, uncertainty, or artifact reference required to avoid incorrect work.]
- [Label unverified claims as hypotheses.]
- [Reference existing specifications, plans, ADRs, issues, commits, diffs, and durable notes instead of copying them.]

Read these files first; at most three exact paths, with no directories or globs:

<read-files>
path/to/minimum-required-file
path/to/authoritative-artifact
</read-files>

Files changed by the source session for this objective. This is an inventory,
not an instruction to read every file:

<modified-files>
path/to/relevant-changed-file
</modified-files>
```

## Content rules

- Restate the goal, current state, and exact next action even when another artifact owns the fuller context.
- Do not summarize the conversation chronologically.
- Do not duplicate material already preserved in an artifact; cite the artifact and explain why it matters.
- Include only work-relevant modified files. Mention unrelated dirty files only when they create a concrete safety risk.
- Never include credentials, authentication material, private keys, environment values, signed URLs, or unnecessary sensitive personal or customer information.
