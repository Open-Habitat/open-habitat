---
created: 2026-10-03
updated: 2026-10-04
type: task
status: done
priority: normal
lane: worktree-agent-design
lane_seq: 10
closed: 2026-10-04
closed_by: claude
---

# Decide the browser boundary for Taskfleet and worktree integration

Worktree agents should be first-class agents in Omega Habitat: a person creates
work from a Git workspace, finds its agent and works with it in the browser.
Taskfleet is the chosen tool for managing that native work. Its normal terminal
worker does not support browser control, so this required a launch and control
decision beyond displaying Taskfleet tool calls in a conversation.

Jari approved the division on 4 October 2026: Taskfleet owns run and worktree
creation and settlement; the per-user daemon starts and controls a separate Pi
child in the verified checkout. The decision and its reasons are recorded in
[ADR 0010](../../docs/decisions/adr-0010-taskfleet-worktree-agents.md).
The [integration design](design.md) describes the intended browser experience.

[Manage agent worktrees](../manage-agent-worktrees/item.md) implements the host
side, together with Taskfleet's `caller-owned-agent-runs` issue. Worktree
placement under `~/src` and which merge, salvage and discard actions appear in
the browser were left to that implementation, starting from discoverable
workspaces and native CLI settlement. Other and manual worktrees remain
read-only observations. The architecture decision is complete; integration
implementation is separate work.

[Expose native status](../expose-native-status/item.md) covers richer profile
and worker telemetry beyond the basic worktree-agent experience.
