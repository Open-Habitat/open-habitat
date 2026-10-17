---
created: 2026-10-17
updated: 2026-10-17
type: task
reporter: jari
status: in-progress
priority: high
lane: unlaned
collision: [issues/proto-interactive-worktrees]
preparation: ready
---

# Prototype: browser-created interactive worktree agents

Jari, 2026-10-17: "haluan, että käyttäjä voi luoda itselleen interaktiivisia worktree-agentteja eli tulee worktree ja siihen agentti, ja sitten heti tietenkin ne worktreeihin liittyvät merkit, muut kontrollit ja tilakontrollit."

The person can create an interactive worktree agent from the browser: a new git worktree of the workspace with its own agent (Pi) that the person talks to directly, with the worktree's marks, controls and state (branch, ahead/behind, merge/discard, running/waiting/done) visible and controllable. This goes beyond ADR 0017, which made spinoffs observe-only and deferred browser-created, browser-controlled worktree agents (`manage-agent-worktrees`, obsolete; ADR 0010; Taskfleet's `caller-owned-agent-runs`).

Two parallel tracks:
1. **Host architecture sketch** (`research-worktree-agents-host`): who creates the worktree and owns the run (Taskfleet caller-owned runs, the daemon directly, or `workmux`), how the browser-run Pi in the worktree relates to Taskfleet's lifecycle and settlement (merge, discard, preserved work), how it shows up natively over SSH/tmux, and what ADR 0010/0017 would need to change. Ends in a recommendation for Jari, not an ADR.
2. **Prototype round** (this issue, `proto-interactive-worktrees`): how a worktree agent is created, how it appears in the rail and the workspace page next to conversations and spinoffs, its marks and state controls, and its end (merge, discard, keep).

## Acceptance Criteria
- [ ] Prototype round with three directions and questions for Jari; the host sketch is linked.

## History
On 2026-10-15 `proto-worktree-agents` prototyped user-started worktree agents (directions Keskusteluna, Tehtävänä, Paikkana; `issues/manage-agent-worktrees/architecture.md`). On 2026-10-16 Jari set them aside because Taskfleet's worktree agents are subordinate to the agent that started them, and spinoffs became observe-only (ADR 0017). This 2026-10-17 request reopens the user-started, interactive case explicitly; start from that earlier round and its result rather than from scratch, and keep spinoffs as they are.
