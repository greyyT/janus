# Grants

Standing authority for grant-gated actions at `project` or `global` scope. Work-scoped grants live in the ticket's `## Grants`. The authority rule in `AGENTS.md` decides how grants apply; the `decisions` skill decides how they are written, changed, and revoked.

## Grant-gated actions

Ordinary in-scope work needs no grant: reading, editing local files, running tests, inspecting diffs, local verification, and established execution skills. These actions need one:

- creating commits;
- pushing, force-pushing, amending, or rewriting published history;
- opening, updating, commenting on, or merging pull requests;
- posting or dismissing external replies or review feedback;
- deleting branches, or files outside the requested change; `git reset --hard`;
- deploying;
- live external calls: provider or paid APIs, live services, and changes to dev or production data;
- continuing a multi-step workflow without stopping between steps (an automated loop);
- anything else destructive, hard to reverse, or visible to others.

The coordinator's copy of this list is in `coordinator/.pi/SYSTEM.md`, because coordinators cannot read Janus files. Change both together.

## Entry format

```md
### Short title · G-NNN

- scope: global | project: Project Title
- allows: the exact actions, or `none` for a prohibition
- excludes: actions carved out of `allows`, or prohibited outright
- uses: unlimited | N remaining
- expires: YYYY-MM-DD | until revoked
- source: user, YYYY-MM-DD, where it was said
```

## Active

### Dream commits and opens its PR · G-001

- scope: global
- allows: during a dream run (`tools/dream/dream.sh`), moving the main checkout's uncommitted changes into the dream worktree; committing there; pushing `dream/*` branches; opening and updating the dream PR; removing the dream worktree and its local branch afterwards
- excludes: merging the dream PR; pushing to `main`; force-pushing
- uses: unlimited
- expires: until revoked
- source: user, 2026-10-06, Janus session designing Dream

## Revoked

_None yet._
