---
created: 2026-10-18
updated: 2026-10-18
type: feature
reporter: jari
status: done
priority: high
preparation: ready
lane: worktree
lane_seq: 3
collision: [web/src/app/, contracts/v1/]
related: ['@proto-interactive-worktrees']
blocked_by: ['@adr-worktree-place', '@implement-git-status-topbar']
closed: 2026-10-18
closed_by: worker
---

# Interactive worktree agents (Yläpalkissa)

Implement interactive worktree agents as Jari decided on 2026-10-18 (`issues/proto-interactive-worktrees/result.md`, "Jari's decision" and the host decisions under it; the ADR from `adr-worktree-place`). Prototype `design-system/prototypes/rounds/2026-10-17-worktree-agentti/`, direction **Yläpalkissa**.

- A worktree is an ordinary `git worktree` created from a new empty conversation (base = the workspace's current branch) or by an agent; it holds ordinary browser conversations. No Taskfleet run, no settlement buttons: merge and discard are asked of the agent, and the top bar shows the state from Git (via `implement-git-status-topbar`).
- The worktree appears under its workspace with its marks (rail, workspace page) as in the prototype; term "worktree-agentti".

## Acceptance Criteria
- [x] Create a worktree agent from the browser, talk to it, ask it to merge, see the top bar and rail reflect the merged state; browser tests; lab screenshots against the prototype.
