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

This issue owns M4 and the A6 proof. Use CG-03's exact `owner/repository` confirmation bound to a fresh observation. Cover denied/partial/cross-user cases with deterministic fixtures, then run one authorized private disposable create→origin→ordinary HTTPS Git push→clone/pull→verified delete smoke from the mapped daemon environment. Its visual-acceptance report includes essential screenshots. Do not run a separate broad two-user permission campaign. No browser secret upload or persistent gateway credential broker. See [the implementation briefs](../plan-v1-implementation/implementation-briefs.md).


## Jari visual acceptance gate

This issue is both the executable delivery and its serial human checkpoint. The worker must leave it in `testing`, not close it. While a `ui-v1` issue is in `testing`, it is a non-launchable human-acceptance hold: no round may spawn, resume or close a worker for it. Before any later `ui-v1` lane member may treat its user-visible behavior as delivered, `issues/connect-github-workspaces/visual-acceptance.md` must record the exact product revision, browser/OS/environment, deterministic test fixtures, happy path and every relevant unhappy state, exact Playwright/test commands and results, and links to the essential Playwright screenshots. Screenshots are evidence, not a replacement for assertions. The conductor presents that report to Jari and records his explicit dated accept/change decision in this issue. Only the conductor may then close it; lane serialization keeps the next product slice behind this checkpoint without assigning a lane to a `human-review` issue or letting a worker self-accept.

Interactive and repeated behavior must use the shared production component implementation. Local composition may arrange one-off content but may not invent controls, state semantics, focus rules or styling. When this production slice replaces a canonical/root mock or static reference, remove the superseded root/canonical reference in the same accepted change; an original may remain only in its receiving issue as historical evidence.
