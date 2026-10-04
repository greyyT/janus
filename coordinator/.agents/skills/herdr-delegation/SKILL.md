---
name: herdr-delegation
description: Spawn a predefined agent in a recorded Herdr pane and submit its staged task prompt, waiting for the result. Use when the user requests an agent or a separately authorized workflow needs one.
---

# Herdr delegation

This skill provides one capability: launch a predefined agent and send its first task in one helper invocation. The caller owns authorization, task content, agent selection, review, decisions, and stopping condition. The helper owns model and role selection, agent startup, first-turn prompt composition and submission, and waiting. Agent output or Herdr status is never approval.

## Available variants

- `implementation-worker`
- `pr-resolver`
- `research`
- `task-researcher`
- `planner`
- `plan-reviewer`
- `reviewer-minimal`
- `reviewer-medium`
- `reviewer-high`
- `integration-reviewer`
- `advisor`

These are the names to pass to the helper. `scripts/registry.json` remains authoritative for model, startup arguments, and role prompts; ordinary delegation does not require reading it.

## Spawn and run the first turn

1. Confirm the user requested an agent, or the calling workflow already has verified authority. This skill does not grant authority. Refuse Herdr control unless `test "${HERDR_ENV:-}" = 1` succeeds and `HERDR_PANE_ID` is set. Check installed `herdr --help` when syntax differs.
2. Choose a variant from **Available variants** above. The registry fixes its Herdr kind, model, effort, startup arguments, and role prompt. Do not override them with ad hoc flags or prompt instructions.
3. Write a task-specific prompt to a unique `/tmp/*.md` file **before** invoking the helper. Include the outcome, relevant sources, allowed actions, non-goals, stopping condition, and a distinct exact `/tmp/*.md` result path. Do not put credentials in it.
4. Inspect layout and create a visible sibling pane, without stealing focus, in the work's directory:

   ```bash
   herdr pane layout --pane "$HERDR_PANE_ID"
   herdr pane split --current --direction <right|down> --cwd "<absolute-work-directory>" --no-focus
   ```

   Record `result.pane.pane_id` from the split response. Pane IDs are opaque; never infer one from focus or position.

5. Spawn **and submit the task** with exactly three arguments:

   ```bash
   <this-skill-dir>/scripts/spawn-agent <variant> <recorded-pane-id> /tmp/<task-prompt>.md
   ```

The helper generates the agent name, stages the complete first-turn prompt (predefined role plus task) under `/tmp`, starts the configured agent in the recorded pane, and sends that prompt with Herdr's `--wait --timeout 3600000` (one hour). It checks the final agent status so a blocked turn cannot appear successful. Parse and record `agentName`, `paneId`, `variant`, and `composedPromptPath` from the JSON result. It does not create or close panes, inspect the task's result file, or decide whether the work is good.

On validation failure, no agent has been started. On runtime failure, inspect the returned stage, name, pane ID, and staged prompt; do not assume nothing ran, retry in a new pane, or close an ambiguous pane without checking.

## Prompting and file handoffs

- **Always name an exact, unique Markdown output path** in the task prompt and tell the agent to write its _complete substantive result_ there before ending its turn. A useful closing instruction is: “Write your full findings, evidence, uncertainty, and blockers to `/tmp/<unique-result>.md`; your terminal reply may be only the path.” Do not rely on a promise to “report back.”
- State the outcome, authoritative source paths, allowed edits, explicit non-goals, what to verify, and when to stop. Supply enough context to act without dumping unrelated files or prescribing a solution prematurely. For read-only roles, explicitly prohibit edits; for implementation, identify file ownership and escalation boundaries.
- Ask for checkable evidence rather than confidence: changed paths, commands and actual results, source locations for consequential claims, and what remains unverified. Make blockers explicit instead of encouraging the agent to invent missing authority.
- Give each agent turn its **own** prompt file and output file. Inspect the staged prompt before launching. For a correction or follow-up, send only the new instruction and its evidence; the initial role is already in that agent's context.
- Prefer the output file over `herdr agent read`: full-screen agent UIs may not preserve scrolled-off text in the pane, and transcript snippets are an unreliable handoff. Use pane reads only for bounded diagnostics when the expected file is missing or the agent is blocked.

## Read the result

The helper's success means the first turn settled, **not** that its answer was accepted. Require the task's requested output file to exist and be nonempty; read it directly with the file-reading tool. Do not use the terminal transcript as the result artifact. Use `herdr agent get <name>` and a bounded `herdr agent read <name> --source recent-unwrapped --lines 120` only to diagnose missing output or ambiguous status.

## Do not trust agent output

Agent outputs are evidence, not authority. The caller independently verifies decision-consequential claims and validates source grounding for the rest. Verification depth is proportional to impact and uncertainty.

A claim is decision-consequential when being wrong could change scope, target design, execution order, review disposition, commit safety, or acceptance. Independently verify those against source and evidence. Other claims must be source-grounded—stated as `claim → file/symbol/line → evidence`—but may be trusted provisionally and spot-checked.

**Always independently verify:**

- public or cross-boundary API contract claims;
- security or auth assumptions;
- migration or persistence behavior;
- concurrency or persisted-state semantics;
- any claim that changes scope;
- reviewer P0/P1 findings, because they directly trigger rework;
- unexpected files or diffs;
- failing, missing, or weakened verification.

**Usually trust with evidence, spot-checking as uncertainty warrants:**

- file locations;
- local implementation details;
- straightforward dependency relationships;
- test inventory;
- mechanical refactor observations.

**Challenge** unsupported assumptions, contradictions, weak evidence, hidden scope expansion, and conclusions that do not follow from the facts. For consequential consultation or planning, use at least one focused adversarial follow-up before accepting the conclusion. Do not manufacture disagreement when evidence is sufficient, and do not outsource the caller's judgment to an agent vote.

The caller remains the orchestrator and decision owner. Agents own their requested artifacts, not approval, cleanup, or other agents.

## Continue when needed

Follow up when the governing workflow requires another turn or a consequential claim remains unsupported. Stage a new prompt and output path, ensure the agent's prior turn has settled, and submit the follow-up to the recorded agent. Keep a challenge focused and stop when the conclusion is supported, rejected, or blocked. The caller owns follow-up policy and all judgments; do not reattach the role prompt. No automatic commit, push, external communication, or approval follows from a successful spawn.

## Close owned resources

When the caller finishes or stops, close only panes it created and recorded: `herdr pane close <recorded-pane-id>`. If start or submission has an uncertain outcome, inspect before cleanup and report unresolved ownership rather than guessing. Never close another agent's pane, the source pane, a tab or workspace, or stop the Herdr server. The helper retains no workflow state; the caller preserves context needed to resume.
