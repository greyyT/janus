# Task research contract

Use this reference when investigating a task before target design or implementation planning.

## Outcome

Read the canonical `TASK.md`, then produce a source-grounded `CURRENT_DESIGN.md` that explains the task-relevant system as it exists today. Research establishes what is true; it does not reinterpret the task contract or choose what the system should become.

The research phase is complete when the load-bearing facts are verifiable, the blast radius and constraints relative to `TASK.md` are understood, and any potential consequential target decisions have been surfaced.

## Source grounding

- Read `TASK.md` and applicable repository conventions before investigating.
- Inspect authoritative source, tests, configuration, and repository documentation directly.
- Trace important consumers and boundaries far enough to explain the task's real blast radius.
- Cite files and symbols, adding line ranges when useful and reasonably stable.
- Distinguish verified facts, interpretations, uncertainty, and missing evidence.
- Do not treat existing comments, generated summaries, or prior task artifacts as more authoritative than current source.

Stop expanding when the evidence is sufficient for the supplied task. Do not turn `CURRENT_DESIGN.md` into a general repository survey.

## `CURRENT_DESIGN.md` contract

Record only task-relevant current state:

- existing behavior and control or data flow;
- affected files, symbols, modules, consumers, and external boundaries;
- tests and verification surfaces that encode current behavior;
- constraints, invariants, compatibility requirements, and known failure behavior;
- contradictions, uncertainty, and facts not verified;
- the blast radius that a later target design and plan must account for.

Contradictions and tensions may be recorded when they are present facts. Recommendations, adopted approaches, and desired-state decisions do not belong in `CURRENT_DESIGN.md`.

Keep the catalog proportional to the task. A mechanical change may need only a short `CURRENT_DESIGN.md`; do not manufacture documentation volume.

## Open-decision handoff

Potential decisions are analysis, not current-state facts. Keep them out of `CURRENT_DESIGN.md`.

Put them in the requested transient report under `## Potential target decisions`, separate from the canonical current-state artifact.

For each potential decision, provide:

- the question;
- the source evidence or constraint that makes it necessary;
- why different answers could materially change the target or plan;
- feasible options only when source evidence supports them;
- remaining uncertainty.

Do not choose an option, adopt a default, or treat silence as consent. Decision classification occurs after research under the Tasks skill's phased flow.

If no potential target decision exists, state that plainly and explain why the task appears mechanical or already settled.

## Stopping boundary

During research:

- treat `TASK.md` as read-only and report any material ambiguity or contradiction in the research handoff;
- create or revise only `CURRENT_DESIGN.md`;
- do not create or revise `TARGET_DESIGN.md`, `PLAN.md`, `TODOs.md`, or `STEP-<N>.md`;
- do not edit implementation source;
- do not represent proposed or planned behavior as current fact;
- report evidence, potential decisions, uncertainty, and blockers, then stop.