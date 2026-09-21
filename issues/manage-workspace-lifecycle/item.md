---
created: 2026-09-21
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 60
blocked_by: ['@build-agent-control']
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
