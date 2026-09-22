---
created: 2026-09-21
updated: 2026-09-22
type: task
status: in-progress
priority: normal
epic: native-agent-host-architecture
lane: planning
lane_seq: 60
blocked_by: ['@define-host-contracts']
collision: [docs/, AGENTS.md, design-system/]
---

# Specify the production design system and integrated UI

## Goal

Turn accepted designs into a coherent component and interaction specification on the proposed frontend stack. This is the production design pass; actual runtime components land in @build-design-system.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [x] Reconcile workspace and conversation token/interaction differences, including the intended theme scope, using the shared design-system sources.
- [x] Define general primitives and product-specific components, public props/events, variants and loading/disabled/error/empty states in `design-system/`; do not duplicate Pi/network logic in visual components.
- [x] Cover missing dialogs, menus, form fields and navigation patterns needed by the accepted MVP; do not build speculative library breadth.
- [x] Define semantics, keyboard/focus, contrast/non-color information, reduced motion and accessible streaming announcements; agree which existing primitives to reuse.
- [x] Specify route/deep-link behavior, drafts, scrolling, selection/copy and combined navigation/conversation behavior against the real capability contract.
- [x] Update `docs/design-system.md` and `docs/ui.md` with reviewable examples and links; preserve received deliveries as references.
- [x] Prepare a design correction round for @review-implementation-plan, including deviations and component catalog acceptance. No production app implementation.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.
