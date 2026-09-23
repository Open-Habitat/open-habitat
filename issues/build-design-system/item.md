---
created: 2026-09-21
updated: 2026-09-23
type: task
status: done
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 20
blocked_by: ['@build-app-foundation']
collision: [docs/, AGENTS.md, design-system/]
closed: 2026-09-23
closed_by: jari
commits:
- hash: 9fc0840
  summary: Complete production design system and catalog
- hash: b7d8fb0043b5f251b7d8bd0eda31bbb6018276dd
  summary: Prepare design system visual acceptance
---

# Implement reusable production UI components and catalog

## Goal

Implement the first production component set from the accepted design system. The product and catalog must import the same implementations.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [x] Implement accepted tokens/styles and the primitives needed by navigation and conversation: controls, inputs, menus/dialogs, banners/status, with typed interfaces.
- [x] Implement the initial product components needed by the next slices; keep native/network behavior in the application layer.
- [x] Build an executable catalog from those same components, covering representative content and all relevant interaction states.
- [x] Verify semantic controls, keyboard/focus handling, non-color state, contrast and reduced motion with proportionate interaction/accessibility checks.
- [x] Make representative visual review available through the accepted preview method; document changes against the approved specification.
- [x] Clearly distinguish production components from retained delivery references and update `docs/design-system.md`; later features extend this same library.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.

## Bounded planning handoff

Implement the bounded catalog at production-design revision `62c0ae6833301bcdd0901053ea08ef514a929153`. `web/src/components` is the single implementation imported by the app and Storybook. Cover both themes, keyboard/focus, 200% zoom, reduced motion, hostile/long Finnish fixtures and all relevant unknown/stale/partial/read-only states. Do not place HTTP/SSE, command IDs, retries or native reconciliation in components. Exact tests and rollback are in [the implementation briefs](../plan-v1-implementation/implementation-briefs.md).


## Jari visual acceptance gate

This issue is both the executable delivery and its serial human checkpoint. The worker must leave it in `testing`, not close it. While a `ui-v1` issue is in `testing`, it is a non-launchable human-acceptance hold: no round may spawn, resume or close a worker for it. Before any later `ui-v1` lane member may treat its user-visible behavior as delivered, `issues/build-design-system/visual-acceptance.md` must record the exact product revision, browser/OS/environment, deterministic test fixtures, happy path and every relevant unhappy state, exact Playwright/test commands and results, and links to the essential Playwright screenshots. Screenshots are evidence, not a replacement for assertions. The conductor presents that report to Jari and records his explicit dated accept/change decision in this issue. Only the conductor may then close it; lane serialization keeps the next product slice behind this checkpoint without assigning a lane to a `human-review` issue or letting a worker self-accept.

Interactive and repeated behavior must use the shared production component implementation. Local composition may arrange one-off content but may not invent controls, state semantics, focus rules or styling. When this production slice replaces a canonical/root mock or static reference, remove the superseded root/canonical reference in the same accepted change; an original may remain only in its receiving issue as historical evidence.

## Decisions

### 2026-09-23T15:02:22Z · @jari

Accepted on 2026-09-23: Jari reviewed the inline light, dark and stale/read-only/uncertain/partial-state screenshots and approved the production design system at product revision 9fc0840. The conductor independently reran the complete clean-checkout gate with repository-local Go/TMPDIR; it passed. This acceptance releases build-workspace-slice but does not pre-accept later journey behavior.

## Resolution

### 2026-09-23T15:02:22Z · @jari

Jari explicitly accepted the representative light, dark and unhappy-state evidence. Deterministic component, keyboard/focus, Playwright, Axe and complete repository gates pass; release the next ui-v1 slice.
