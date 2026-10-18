---
created: 2026-10-18
updated: 2026-10-18
type: feature
reporter: jari
status: in-progress
priority: high
preparation: ready
lane: topbar
lane_seq: 1
collision: [web/src/app/, internal/daemon/git, contracts/v1/]
related: ['@proto-git-status-panel']
---

# Git status in the top bar (Yläpalkissa)

Implement the Git status Jari chose on 2026-10-18 in `proto-git-status-panel`: direction **Yläpalkissa** ("Ehdottomasti yläpalkissa"). The prototype is `design-system/prototypes/rounds/2026-10-17-git-tila/` (build with `node design-system/prototypes/build.mjs <round-dir>`); `issues/proto-git-status-panel/result.md` describes the direction, the details view and the host facts.

- Top bar of the conversation view: branch, ↑/↓ against the upstream and against the base branch, incoming from the remote, changed files; clicking opens the details (commits ahead/behind by name, files, upstream, last fetch, Hae etärepo, Lue uudelleen) as in the prototype, desktop and phone.
- Host facts the result lists as new: base-branch comparison (choose the base: a worktree's source branch, else `origin/HEAD`, else the GitHub default branch; record the rule) and named commit lists for each comparison with limits. The daemon reads these natively as the user; no store.
- This top-bar Git status is also what worktree agents will show (`proto-interactive-worktrees`, decided 2026-10-18: a worktree is a place, merged-or-not comes from Git), so expose "merged into base" as a fact.

## Acceptance Criteria
- [ ] Top-bar Git status and details as in the prototype; lab screenshots compared with the prototype in the same states; host tests for the base comparison and commit lists.
