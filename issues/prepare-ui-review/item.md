---
created: 2026-09-21
updated: 2026-09-22
type: task
status: in-progress
priority: normal
epic: native-agent-host-architecture
lane: planning
lane_seq: 20
blocked_by: ['@define-mvp-scope', '@probe-pi-control', '@probe-workspace-lifecycle']
collision: [docs/, AGENTS.md]
---

# Prepare the combined MVP and UI review

## Goal

Bring the product journeys, both designs and native capability evidence together into a reviewable proposal for Jari. Delivery means the review package is ready, not accepted.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [ ] Integrate both probes into `docs/assumptions.md`, preserving version, evidence, limits and effects on the design.
- [ ] Update `docs/product.md` and `docs/ui.md` with one login-to-conversation flow and the accepted full-MVP host operations.
- [ ] Walk through disabled/read-only, pending, failed, uncertain-send and reconnect states; no mock may become evidence of backend support.
- [ ] Prepare a concise `review.md` here with direct links, exact unresolved decisions, recommended answers and visual references.
- [ ] Explain any technically necessary deviation from the accepted direction; do not silently drop GitHub, worktree, archive or workspace operations.
- [ ] Hand the package to @review-ui-v1. No product code, replacement designer, or autonomous design acceptance.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.
