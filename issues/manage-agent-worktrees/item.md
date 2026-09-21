---
created: 2026-09-21
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 90
blocked_by: ['@connect-github-workspaces']
collision: [docs/, AGENTS.md, design-system/]
---

# Manage agent worktrees

## Goal

Implement the accepted Git worktree creation flow and its agent navigation representation.

## Context

Use the accepted workspace handoff in `../receive-designer-v1/design/workspaces/AGENTS.md`, while keeping Git and the native orchestrator authoritative.

## Scope

Do not create a browser-specific worktree registry or generic Taskfleet control protocol. The UI invokes the selected native lifecycle operation and projects observed results.

## Acceptance Criteria

- [ ] Offer worktree creation only for Git workspaces and explain why it is unavailable otherwise.
- [ ] Validate the worktree/branch name and selected base before invoking the native operation.
- [ ] Start the accepted new agent flow only after the worktree identity is available.
- [ ] Show the resulting worktree agent under its parent context without assuming every agent has a hierarchy.
- [ ] Verify duplicate branch, dirty state, native-operation failure and disconnect behavior.

## Implementation and evidence

Use the [delivery plan](../plan-v1-implementation/plan.md), accepted implementation
briefs and exact checks verified by @build-app-foundation. Save `result.md` here with
the tested revision, commands, outcomes and remaining limits. Update the affected
durable documents and component examples; do not duplicate task state in TODO.md.
