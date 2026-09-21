---
created: 2026-09-20
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: planning
lane_seq: 70
blocked_by: ['@review-ui-v1', '@choose-frontend-stack', '@choose-host-stack', '@define-host-contracts', '@design-production-ui']
commits:
- hash: f2c326d23549333032af795b61b163b97040f854
  summary: 'docs(ui): schedule the accepted MVP capabilities'
collision: [docs/, AGENTS.md]
---

# Specify implementation slices and verification from the agreed design

## Goal

Assemble the proposed technical decisions, native evidence, contracts and production UI
specification into bounded, reviewable implementation briefs. Do not implement the product.
The staged [delivery plan](plan.md) is the starting point, not a second execution queue.

## Inputs

- @review-ui-v1: accepted product journeys and design direction.
- @choose-frontend-stack and @choose-host-stack: proposed stack ADRs and trials.
- @define-host-contracts: commands/events, authority and failure semantics.
- @design-production-ui: component and integrated interaction specification.
- [Product](../../docs/product.md), [assumptions](../../docs/assumptions.md),
  [architecture](../../docs/architecture.md) and [interfaces](../../docs/interfaces.md).

## Scope

Retain native histories/configuration, filesystem discovery and HTTP/SSE. No registry,
parallel history, credential broker, speculative cache, mobile or multi-server UI.
Reuse the existing downstream issues; split only when a concrete brief is too large.
Changes to scope require a recorded product decision. No worker runs in this task.

## Acceptance Criteria

- [ ] Integrate probe findings and proposed decisions into a consistent implementation plan; each critical assumption has evidence or an explicit accepted limitation awaiting review.
- [ ] Write `implementation-briefs.md` here with inputs, bounded outputs, file ownership, test scenarios and exact proposed commands for each downstream issue.
- [ ] Define bootstrap/build/check/test commands for @build-app-foundation; that task must make them runnable and verify them before later product workers depend on them. Mark commands as proposed until then.
- [ ] Update downstream issue boundaries and dependencies using issuectl; retain a minimal real core before completing the full conversation UI and host operations.
- [ ] Specify test identities, native fixtures, rollback, target and exact deployment/live-version commands with explicit authorization status; no invented working deployment.
- [ ] Map every full-MVP success criterion to an implementation owner and an end-to-end/pilot verification owner, including two-user separation from the first authenticated slice.
- [ ] Prepare `review.md` here linking ADRs, contract examples, design/component specification, expected deviations and exact decisions for @review-implementation-plan.
- [ ] Update `docs/implementation.md`, `docs/decisions.md`, `docs/interfaces.md` and `docs/status.md` to distinguish proposed, accepted and implemented work. Run documentation checks and validate the issue DAG.

## Delivery

Close this preparation task when its package is complete. It does not accept the ADRs or
close @review-implementation-plan; production code remains blocked on that human review.
