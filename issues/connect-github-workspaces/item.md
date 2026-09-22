---
created: 2026-09-21
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 80
blocked_by: ['@manage-workspace-lifecycle']
collision: [docs/, AGENTS.md, design-system/]
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

## Implementation and evidence

Use the [delivery plan](../plan-v1-implementation/plan.md), accepted implementation
briefs and exact checks verified by @build-app-foundation. Save `result.md` here with
the tested revision, commands, outcomes and remaining limits. Update the affected
durable documents and component examples; do not duplicate task state in TODO.md.

## Bounded planning handoff

This issue owns M4 and the A6 proof. Use CG-03's exact `owner/repository` confirmation bound to a fresh observation. Run the authorized private disposable create→origin→ordinary Git push→clone→second push/pull→verified delete sequence separately for both pilot users from the daemon environment, including denied/partial cases. No browser secret upload or gateway credential broker. See [the implementation briefs](../plan-v1-implementation/implementation-briefs.md).
