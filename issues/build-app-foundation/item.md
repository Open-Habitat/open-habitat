---
created: 2026-09-21
updated: 2026-09-23
type: task
status: done
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 10
blocked_by: ['@review-implementation-plan']
collision: [docs/, AGENTS.md, design-system/]
closed: 2026-09-23
closed_by: jari
commits:
- hash: 079694adf0f9cdabddf6cc7289672d1d813a521f
  summary: Complete application foundation
- hash: c73f14aa7950a3b2e2822f171028eef6f549c6d9
  summary: Move application foundation to visual testing
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

- [x] Establish the chosen UI, daemon/adapter and gateway integration boundaries, shared contract generation and dependency/license policy.
- [x] Make documented development, build, check and focused test commands executable from a clean checkout; configure CI to run the same required checks.
- [x] Supply disposable native fixtures and browser/API test setup without global binary installation or access to real user histories.
- [x] Establish application routes, token loading and connection/auth error boundaries sufficient for the next slice; mock data stays explicitly test-only.
- [x] Validate the accepted package/test-target launch method within its authorization; record limitations instead of fabricating live-version results.
- [x] Update root/local AGENTS.md with exact commands and ownership. Demonstrate the skeleton runs, without claiming the real agent journey is implemented.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.

## Bounded planning handoff

Before scaffolding product slices, make the accepted CG-01–CG-04 and CT-030–CT-034 contracts executable from [the implementation briefs](../plan-v1-implementation/implementation-briefs.md). Establish the locked Go 1.27.1 module, stable TypeScript 7.0.2 + Biome 2.5.14 `web/` graph, deterministic contract generation, AI-first operator CLI, full green gate, package scripts and bare-CI approximation exactly described there. Record the accepted `review-implementation-plan` revision and make every proposed command executable; no later worker may depend on an unproved command. This issue owns root manifests, runtime scaffolding, generated-type families, CI/scripts and root/local command guidance, but does not claim a real user journey.


## Visual evidence

Provide proportionate browser evidence and screenshots in
`issues/build-app-foundation/visual-acceptance.md`, with the tested revision,
environment and relevant outcomes. Record Jari's visual verdict when given;
unreviewed appearance remains unreviewed. A pending screenshot verdict does not
block functional completion or independent downstream work.

Interactive and repeated behavior must use the shared production component implementation. Local composition may arrange one-off content but may not invent controls, state semantics, focus rules or styling. When this production slice replaces a canonical/root mock or static reference, remove the superseded root/canonical reference in the same accepted change; an original may remain only in its receiving issue as historical evidence.

## Decisions

### 2026-09-23T12:08:47Z · @jari

Accepted on 2026-09-23: Jari reviewed the screenshots directly from the repository and approved all three foundation states for product revision 079694adf0f9cdabddf6cc7289672d1d813a521f. The conductor independently reran `./scripts/ci-local.sh --clean --json` with repository-local Go; the complete gate passed. This accepts the bounded scaffold only, not later production UI behavior.

## Resolution

### 2026-09-23T12:08:47Z · @jari

Jari explicitly accepted the ready, authentication-required and daemon-unavailable screenshots. All deterministic assertions, Axe checks and the complete clean-checkout gate pass. Release the next ui-v1 slice.
