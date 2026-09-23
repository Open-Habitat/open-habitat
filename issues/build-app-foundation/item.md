---
created: 2026-09-21
updated: 2026-09-23
type: task
status: in-progress
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 10
blocked_by: ['@review-implementation-plan']
collision: [docs/, AGENTS.md, design-system/]
---

# Build the selected application and validation foundation

## Goal

Create the selected repository/runtime structure and executable quality checks. This is the first production code task; use the accepted technical decisions and implementation briefs.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [ ] Establish the chosen UI, daemon/adapter and gateway integration boundaries, shared contract generation and dependency/license policy.
- [ ] Make documented development, build, check and focused test commands executable from a clean checkout; configure CI to run the same required checks.
- [ ] Supply disposable native fixtures and browser/API test setup without global binary installation or access to real user histories.
- [ ] Establish application routes, token loading and connection/auth error boundaries sufficient for the next slice; mock data stays explicitly test-only.
- [ ] Validate the accepted package/test-target launch method within its authorization; record limitations instead of fabricating live-version results.
- [ ] Update root/local AGENTS.md with exact commands and ownership. Demonstrate the skeleton runs, without claiming the real agent journey is implemented.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.

## Bounded planning handoff

Before scaffolding product slices, make the accepted CG-01–CG-04 and CT-030–CT-034 contracts executable from [the implementation briefs](../plan-v1-implementation/implementation-briefs.md). Establish the locked Go 1.27.1 module, stable TypeScript 7.0.2 + Biome 2.5.14 `web/` graph, deterministic contract generation, AI-first operator CLI, full green gate, package scripts and bare-CI approximation exactly described there. Record the accepted `review-implementation-plan` revision and make every proposed command executable; no later worker may depend on an unproved command. This issue owns root manifests, runtime scaffolding, generated-type families, CI/scripts and root/local command guidance, but does not claim a real user journey.


## Jari visual acceptance gate

This issue is both the executable delivery and its serial human checkpoint. The worker must leave it in `testing`, not close it. While a `ui-v1` issue is in `testing`, it is a non-launchable human-acceptance hold: no round may spawn, resume or close a worker for it. Before any later `ui-v1` lane member may treat its user-visible behavior as delivered, `issues/build-app-foundation/visual-acceptance.md` must record the exact product revision, browser/OS/environment, deterministic test fixtures, happy path and every relevant unhappy state, exact Playwright/test commands and results, and links to the essential Playwright screenshots. Screenshots are evidence, not a replacement for assertions. The conductor presents that report to Jari and records his explicit dated accept/change decision in this issue. Only the conductor may then close it; lane serialization keeps the next product slice behind this checkpoint without assigning a lane to a `human-review` issue or letting a worker self-accept.

Interactive and repeated behavior must use the shared production component implementation. Local composition may arrange one-off content but may not invent controls, state semantics, focus rules or styling. When this production slice replaces a canonical/root mock or static reference, remove the superseded root/canonical reference in the same accepted change; an original may remain only in its receiving issue as historical evidence.
