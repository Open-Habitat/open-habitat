---
created: 2026-10-03
updated: 2026-10-03
type: task
status: open
priority: normal
---

# Decide the browser boundary for Taskfleet and worktree integration

## Product goal

Worktree agents should be first-class agents in Omega Habitat. Taskfleet is
the chosen implementation for creating and managing their native work, as
Jari clarified on 3 October 2026. The design task is to make these agents a
natural part of the browser experience alongside other agents.

Taskfleet remains authoritative for its runs and worktrees. The host presents
and controls that native work through the integration. Jari's earlier
[architecture clarification](../native-agent-host-architecture/item.md)
explains why merely showing Taskfleet tool calls inside Pi needs no separate
protocol. First-class worktree agents now provide a concrete product need
for integration beyond that tool-call view.

## Design to resolve

Define how a person creates, finds, opens and interacts with a worktree agent
in the browser, and how its state and relationship to the parent workspace
are presented. Use the ordinary agent experience as the starting point and
make any necessary differences understandable.

Resolve the launch and control boundary identified in
[Manage agent worktrees](../manage-agent-worktrees/item.md): Taskfleet starts
a terminal agent, while the browser currently treats terminal agents as
read-only. That is a gap to solve for this experience. Recommend how the
browser and Taskfleet cooperate over agent launch and control, and agree
any authority changes with Jari.

## Outcome and implementation

Record the agreed experience and integration design so that
[Manage agent worktrees](../manage-agent-worktrees/item.md) can implement it.
This decision supplies the design that work already needs. Identify any
additional implementation work separately. Exact native ownership matching
and safe worktree cleanup remain part of the implementation task.

[Expose native status](../expose-native-status/item.md) covers additional
native task-profile and worker information; the basic worktree-agent
experience belongs here and in its implementation task.
