---
created: 2026-09-21
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 20
blocked_by: ['@build-app-foundation']
collision: [docs/, AGENTS.md, design-system/]
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

- [ ] Implement accepted tokens/styles and the primitives needed by navigation and conversation: controls, inputs, menus/dialogs, banners/status, with typed interfaces.
- [ ] Implement the initial product components needed by the next slices; keep native/network behavior in the application layer.
- [ ] Build an executable catalog from those same components, covering representative content and all relevant interaction states.
- [ ] Verify semantic controls, keyboard/focus handling, non-color state, contrast and reduced motion with proportionate interaction/accessibility checks.
- [ ] Make representative visual review available through the accepted preview method; document changes against the approved specification.
- [ ] Clearly distinguish production components from retained delivery references and update `docs/design-system.md`; later features extend this same library.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.

## Bounded planning handoff

Implement the bounded catalog at production-design revision `62c0ae6833301bcdd0901053ea08ef514a929153`. `web/src/components` is the single implementation imported by the app and Storybook. Cover both themes, keyboard/focus, 200% zoom, reduced motion, hostile/long Finnish fixtures and all relevant unknown/stale/partial/read-only states. Do not place HTTP/SSE, command IDs, retries or native reconciliation in components. Exact tests and rollback are in [the implementation briefs](../plan-v1-implementation/implementation-briefs.md).
