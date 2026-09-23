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


## Jari visual acceptance gate

This issue is both the executable delivery and its serial human checkpoint. The worker must leave it in `testing`, not close it. While a `ui-v1` issue is in `testing`, it is a non-launchable human-acceptance hold: no round may spawn, resume or close a worker for it. Before any later `ui-v1` lane member may treat its user-visible behavior as delivered, `issues/manage-workspace-lifecycle/visual-acceptance.md` must record the exact product revision, browser/OS/environment, deterministic test fixtures, happy path and every relevant unhappy state, exact Playwright/test commands and results, and links to the essential Playwright screenshots. Screenshots are evidence, not a replacement for assertions. The conductor presents that report to Jari and records his explicit dated accept/change decision in this issue. Only the conductor may then close it; lane serialization keeps the next product slice behind this checkpoint without assigning a lane to a `human-review` issue or letting a worker self-accept.

Interactive and repeated behavior must use the shared production component implementation. Local composition may arrange one-off content but may not invent controls, state semantics, focus rules or styling. When this production slice replaces a canonical/root mock or static reference, remove the superseded root/canonical reference in the same accepted change; an original may remain only in its receiving issue as historical evidence.
