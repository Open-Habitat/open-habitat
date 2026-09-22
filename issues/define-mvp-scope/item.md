---
created: 2026-09-21
updated: 2026-09-22
type: task
status: done
priority: normal
epic: native-agent-host-architecture
lane: planning
lane_seq: 10
collision: [docs/, AGENTS.md]
closed: 2026-09-22
closed_by: agent
---

# Define MVP journeys and acceptance scenarios

## Goal

Turn the accepted direction into testable desktop user journeys for the working core and full MVP. This is definition work, not implementation.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [x] Refine `docs/product.md` with concrete success/failure scenarios for login, discovery, conversation, workspace lifecycle, GitHub, worktrees and archive.
- [x] Distinguish the working-core demonstration from full-MVP acceptance; retain all already accepted host features.
- [x] Refine `docs/ui.md` with a journey/state inventory and references to the two received designs; mark pending choices and mocked behavior explicitly.
- [x] Inventory needed components and missing states without changing design tokens or choosing a frontend runtime.
- [x] Refine `docs/assumptions.md` with claims, evidence needed, responsible issues and consequences if false; initial claims remain unverified.
- [x] Prepare questions for @prepare-ui-review, including queue/steering, synopsis, focus/drafts, and attention when another agent needs a response.
- [x] State measurable pilot acceptance criteria and initial representative workload; a proposed criterion is not Jari's approval.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.
