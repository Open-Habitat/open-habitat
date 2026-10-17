---
created: 2026-10-17
updated: 2026-10-17
type: task
reporter: jari
status: open
priority: high
lane: unlaned
collision: [issues/research-worktree-agents-host]
preparation: ready
related: ['@proto-interactive-worktrees']
---

# Research: host architecture for interactive worktree agents

Host architecture sketch for `proto-interactive-worktrees` (Jari, 2026-10-17: browser-created interactive worktree agents with their marks and state controls). Read `issues/proto-interactive-worktrees/item.md`, the earlier round `issues/proto-worktree-agents/`, ADR 0010 (`docs/decisions/adr-0010-taskfleet-worktree-agents.md`), ADR 0017 (observe-only spinoffs), `issues/manage-agent-worktrees/` (its `architecture.md`), `issues/implement-spinoff-agents/`, `internal/AGENTS.md`, `docs/architecture/`, and the Taskfleet repository (`~/Sources/taskfleet`: `caller-owned-agent-runs` issue, run/merge/discard docs).

Answer: which component creates the worktree and owns its lifecycle; how the worktree's Pi is started and controlled by the daemon as the user while Taskfleet (or not) owns settlement; what natively remains visible over SSH/tmux; how merge, discard and preserved work map to browser controls; what the browser can show about state (branch, ahead/behind, dirty, running); what cross-repo contract Taskfleet needs; risks for the Unix-user boundary. Present at least two options with trade-offs and a recommendation, and say exactly what ADR 0010/0017 would need to change. Do not write an ADR: architecture is decided with Jari.

Output: `issues/research-worktree-agents-host/report.md`.
