---
created: 2026-10-15
updated: 2026-10-15
type: task
reporter: jari
status: done
priority: high
lane: proto-worktrees
lane_seq: 1
collision: [design-system/prototypes/rounds/proto-worktree-agents]
preparation: ready
closed: 2026-10-15
---

# Prototype: worktree agents through Taskfleet

Jari 15.10.2026: every new feature is prototyped first; the working prototype Jari accepts is its specification, and implementation waits for his evaluation. The round is made in its own worktree under `design-system/prototypes/AGENTS.md` ("Prototyyppiworker") and the `prototype` skill. Alongside it, an architecture sketch says how the server side would do it, in a separate file, following the project principles in `CLAUDE.md` (Unix users as the boundary, native tools own their history, credentials and processes; no parallel store or broker). The sketch is a proposal for Jari, not an accepted ADR.

Jari: support Taskfleet worktree agents, git worktrees (Taskfleet creates the worktree and starts the agent there), and the agents Taskfleet favours that do their work and merge on their own. The accepted division is ADR 0010 (`docs/decisions/adr-0010-taskfleet-worktree-agents.md`) and `issues/decide-taskfleet-browser-integration/design.md`; `manage-agent-worktrees` is the implementation issue, waiting for Taskfleet's `caller-owned-agent-runs` (untriaged in the Taskfleet repo). Prototype: starting worktree work from a workspace, an interactive worktree agent versus a self-merging one, where they appear under the workspace, their states (working, waiting, merged, failed with preserved work), opening the conversation, and the merge outcome.

## Acceptance Criteria
- [ ] `issues/manage-agent-worktrees/architecture.md`: extends ADR 0010 to self-merging agents; what Taskfleet must provide, what the daemon does, what the browser sees.
- [ ] Round verified with check.mjs; `result.md` per the prototype worker rules.
