---
created: 2026-09-21
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 70
blocked_by: ['@complete-conversation-ui']
collision: [docs/, AGENTS.md, design-system/]
---

# Manage local workspace lifecycle

## Goal

Implement the accepted local workspace lifecycle around the discovered `~/src/*` directories.

## Context

Use the accepted workspace handoff in `../receive-designer-v1/design/workspaces/AGENTS.md` and the implementation choices produced by @plan-v1-implementation.

## Scope

Keep the filesystem and Git authoritative. Do not add a workspace registry. Workspace metadata remains limited to the workspace-local `.agent-host/workspace.json` settings justified by the accepted design.

## Acceptance Criteria

- [ ] Create a local workspace with the accepted name and optional `git init` flow.
- [ ] Read and update the workspace display name without renaming its directory.
- [ ] Show detected Git, branch and remote facts without persisting copies of them.
- [ ] Hide a workspace as a presentation preference without removing its directory.
- [ ] Delete a workspace only through the accepted explicit confirmation and report all affected agent processes before execution.
- [ ] Cover success, duplicate-name, permission, disconnect and partial-failure behavior with proportionate automated tests.

## Implementation and evidence

Use the [delivery plan](../plan-v1-implementation/plan.md), accepted implementation
briefs and exact checks verified by @build-app-foundation. Save `result.md` here with
the tested revision, commands, outcomes and remaining limits. Update the affected
durable documents and component examples; do not duplicate task state in TODO.md.

## Bounded planning handoff

This issue owns M2–M3. Use descriptor-relative no-follow filesystem operations, atomic workspace/XDG metadata and staged effects. Test symlink/replacement/mount/process/worktree races and crash at each stage; delete succeeds only after fresh source absence. Taskfleet owns its worktrees, manual worktrees block mutation, and partial never means rollback. See [the implementation briefs](../plan-v1-implementation/implementation-briefs.md).
