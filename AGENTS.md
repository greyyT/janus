# Janus

Janus is a Markdown-first personal engineering knowledge system.

## Knowledge locations

- `brain/` contains promoted, durable wiki knowledge.
- Non-default Markdown files placed directly in the repository root are inbox notes.
- Root inbox notes are temporary and may be incomplete, incorrect, or unverified.
- Source code and repository-local documentation remain authoritative for code behavior.

## Source-of-truth hierarchy

1. Source code and repository-local documentation.
2. Promoted Janus wiki notes under `brain/`.
3. Root inbox notes.
4. Generated indexes, embeddings, summaries, and harness auto-memory.

## Before making a technical decision

1. Read `brain/HOME.md`.
2. Identify the relevant project page under `brain/projects/` when one exists.
3. Search both `brain/` and root inbox notes.
4. Read original Markdown source files, not only search snippets.
5. Verify code-specific claims in the relevant source repository.

## Capturing knowledge

- For rough thoughts, create a Markdown file directly in the Janus root.
- Do not require frontmatter, tags, templates, or classification for root notes.
- Do not store durable technical facts only in a root inbox note.
- Promote durable and verified knowledge into `brain/`.
- Delete low-value or obsolete inbox notes rather than organizing everything.

## Promotion rules

When promoting a root note:

1. Determine whether it is a project, system, decision, pattern, playbook, concept, or investigation.
2. Move it under the correct `brain/` location.
3. Add frontmatter and a stable title.
4. Link it from the relevant project index.
5. Preserve important history; archive rather than silently erasing superseded decisions.

## Do not

- Do not treat inbox notes as verified facts.
- Do not create a separate `brain/inbox/` folder.
- Do not index secrets, keys, credentials, or sensitive production data.
- Do not duplicate repository-owned architecture documentation.
- Do not load the whole knowledge base into context by default.
