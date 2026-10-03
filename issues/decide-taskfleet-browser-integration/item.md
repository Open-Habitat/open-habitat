---
created: 2026-10-03
updated: 2026-10-03
type: task
status: open
priority: normal
---

# Decide the browser boundary for Taskfleet and worktree integration

# Decide the browser boundary for Taskfleet and worktree integration

## Goal

Decide what direct Taskfleet/worktree integration people need beyond viewing the native Pi tool flow, without creating a second authority over runs, worktrees or agent sessions.

## Scope

Jari's [architecture clarification](../native-agent-host-architecture/item.md) says Taskfleet already runs as an ordinary tool inside Pi: this alone does not justify a Taskfleet-specific browser protocol. Revisit a direct orchestration surface only for a concrete human need outside the conversation. Resolve the handoff identified in [Manage agent worktrees](../manage-agent-worktrees/item.md): Taskfleet starts a terminal agent, while the browser does not currently offer a writable composer for terminal agents. Decide what the browser can honestly observe and control, how exact native run/node and worktree ownership is verified, and whether additional integration is justified. Keep manual or unknown worktrees out of destructive cleanup.

This is a later architectural decision; the existing `manage-agent-worktrees` issue remains the scheduled v1 implementation task and `expose-native-status` remains its separate design follow-up. Do not lane this decision yet or silently expand the v1 task.
