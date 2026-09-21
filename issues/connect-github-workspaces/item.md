---
created: 2026-09-21
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 70
blocked_by: ['@manage-workspace-lifecycle']
---

# Connect GitHub workspace flows

## Goal

Connect the accepted GitHub repository creation and clone flows to the workspace UI.

## Context

Use the accepted workspace handoff in `../receive-designer-v1/design/workspaces/AGENTS.md` and the authentication/credential boundary chosen by @plan-v1-implementation.

## Scope

Do not build a new credential broker. Use an explicitly selected native GitHub authentication mechanism and keep repository state authoritative in Git and GitHub.

## Acceptance Criteria

- [ ] Detect whether the mapped Unix user has usable GitHub authorization without exposing credentials to the browser.
- [ ] Create a GitHub repository from a local Git workspace with explicit visibility.
- [ ] Search or accept an exact GitHub repository reference and clone it under `~/src`.
- [ ] Keep unavailable and failed GitHub actions visible with actionable reasons.
- [ ] Verify authorization, duplicate destination, network failure and partial Git/GitHub failure behavior.
