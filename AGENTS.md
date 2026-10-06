# Janus

Janus is a Markdown-first knowledge system and personal operating system.

## Knowledge locations

- `journal/` contains dated passive daily records: material changes, ticket-session references, decisions no ticket owns, and rough notes.
- `tickets/` holds managed work: `tickets/BOARD.md` is the canonical state and each ticket file owns its checkpoint and history. See `docs/ticket.md`.
- `brain/` contains promoted, durable wiki knowledge.
- `brain/Precedents.md` holds accepted reusable judgment, and `brain/Grants.md` holds standing authority and the list of grant-gated actions. See `docs/decisions.md`.
- `brain/Working Model.md` holds Janus's beliefs about how the user actually works. Read it before planning, dispatching, or estimating capacity.
- Load the `decisions` skill whenever the user answers a decision Janus brought to them, or states or changes a reusable decision, standing permission, explicit prohibition, or "from now on" behavior.
- Non-default Markdown files placed directly in the repository root are standalone inbox captures unless protected.
- Root inbox notes are temporary and may be incomplete, incorrect, or unverified. Dream considers them every night and resolves those it has enough evidence for.
- Dream (`docs/dream.md`) consolidates each day overnight and proposes every change as one pull request; merging it is the user's approval.
- Source code and repository-local documentation remain authoritative for code behavior.
- `.janus/calendar/` is local optional calendar feed config read by `pnpm brain:calendar`; it is not durable knowledge.
- `.janus/dream/` is local Dream run state and log; it is not durable knowledge.
- `.janus/orientation.json` is local state for the daily orientation (`docs/ticket.md`); it is not durable knowledge.

## Source-of-truth hierarchy

1. Source code and repository-local documentation.
2. Promoted Janus wiki notes under `brain/`.
3. Journal notes under `journal/` as chronological personal records.
4. Root inbox notes.
5. Generated indexes, embeddings, summaries, and harness auto-memory.

## Authority

Before Janus or a coordinator performs a grant-gated action (listed in `brain/Grants.md`), it needs an applicable grant: an unexpired grant with uses remaining, at `global` or `project` scope in `brain/Grants.md`, or at `work` scope in the ticket's `## Grants`. The action is authorized only when an applicable grant allows it and none excludes it; exclusions always win over grants. Neither a precedent nor project direction grants authority. Without an authorizing grant, ask the user: their direct approval of that exact action authorizes it once.

## Before making a technical decision

1. Read `brain/HOME.md`.
2. Identify the relevant project page under `brain/projects/` when one exists.
3. Search both `brain/` and root inbox notes.
4. Read original Markdown source files, not only search snippets.
5. Verify code-specific claims in the relevant source repository.

<important if="you are about to run any command declared in package.json">
Read `commands.md` first. Use it as the local command contract for available scripts, variables, defaults, and required argument shapes before invoking the package command.
</important>

## Capturing knowledge

- Use today's `journal/YYYY-MM-DD.md` only for material changes, ticket-session references, decisions no ticket owns, and rough notes. Never copy ticket content into the journal.
- The journal is not an execution or reminder surface: route fixed-time actions to the calendar, and work that should survive the conversation to tickets or the board inbox.
- For standalone thoughts, articles, ideas, or topics that deserve their own identity, create a Markdown file directly in the Janus root.
- Do not require frontmatter, tags, templates, or classification for root notes.
- Do not store durable technical facts only in a root inbox note, ticket, or journal note.
- Promote durable and verified knowledge into `brain/`.
- Delete low-value or obsolete inbox notes rather than organizing everything.

## Promotion rules

When promoting a root note:

1. Determine whether it is a project, system, decision, pattern, playbook, concept, or investigation.
2. Move it under the correct `brain/` location.
3. Add frontmatter and a stable title.
4. Link it from the relevant project entry page or content-oriented wiki page.
5. Preserve important history; archive rather than silently erasing superseded decisions.
6. Archive approved promoted root captures under `brain/archive/inbox/`; if the destination exists, stop and ask before writing.

## Do not

- Do not treat inbox notes as verified facts.
- Do not create a separate `brain/inbox/` folder.
- Do not place journal workflow documentation inside `journal/`.
- Do not index secrets, keys, credentials, or sensitive production data.
- Do not duplicate repository-owned architecture documentation.
- Do not load the whole knowledge base into context by default.
