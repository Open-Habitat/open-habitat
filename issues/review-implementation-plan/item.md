---
created: 2026-09-21
updated: 2026-09-23
type: task
status: open
priority: normal
epic: native-agent-host-architecture
labels: [human-review]
reviewer: jari
blocked_by: ['@plan-v1-implementation', '@apply-review-corrections']
---

# Review technical decisions and implementation readiness with Jari

## Goal

Human review in the main conversation. Review the concrete proposed technology decisions, contracts, design system and bounded implementation briefs before production coding starts.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [x] Present the linked review package and explicit recommendations from @plan-v1-implementation; prerequisites are delivered.
- [x] Record Jari's actual decisions with date and exact artifact revision; no assumption, silence or worker recommendation counts as acceptance.
- [x] Resolve requested changes before marking done; record accepted ADRs and update the current architecture to match them.
- [x] Record accepted UI/design-system target, remaining limitations, validation commands and operational plan.
- [x] Explicitly record the allowed test/pilot target and deployment scope, or leave deployment unauthorized with a precise later approval step.
- [x] Close only after the agreed implementation prerequisites are accepted. This gate authorizes the scoped implementation, not post-MVP expansion.

## Execution

This issue deliberately has no lane and carries `human-review`. The stint conductor handles it with Jari after its blockers deliver; never spawn it as a worker. If changes are requested, schedule bounded correction work and add it as a blocker. Keep this gate open until the actual decision is recorded.

## Prepared decision package

Review the [corrected implementation package](../plan-v1-implementation/review.md) and the exact correction revision recorded in [`apply-review-corrections/result.md`](../apply-review-corrections/result.md). Jari's eight requested decisions are: (1) React with stable TypeScript 7, Biome and `tsc --noEmit`; (2) one Go host binary plus the accepted restart limit; (3) production design, component ownership/mock retirement and per-slice screenshot acceptance; (4) retention/history bounds and additive CG-01–CG-04; (5) first-four/last-four title input plus automatic/manual regeneration; (6) one GitHub OAuth→web session→native `gh` HTTPS flow, optional explicitly selected Google, session/logout/disconnect boundaries; (7) cross-user fixtures plus one private-repo smoke instead of a broad GitHub campaign; and (8) generic self-hosting ownership, coordinated Fleetrepo/Alder work and the deferred 0.1 cleanup trigger. Alder authorization is already granted after accepted decisions and executable gates; the review records limits rather than asking for a second deployment go/no-go. Keep this issue open until Jari records an explicit dated decision against that revision.

## Decisions

### 2026-09-23T07:27:44Z · @jari

Accepted on 2026-09-23 against artifact revision b87b1aae5d6fefcd914d4f06c0e510b5ca124f60 (evidence/closure 2fa1ef36df832af441816b6dcd1ecb15f55f0f22): all eight corrected implementation-readiness decisions are approved. The later Biome amendment is explicitly approved because the complete stable TypeScript 7 graph passed without forced peers, disabled checks or nightly packages. Alder remains authorized for the bounded pilot after executable green gates; concrete persistent state belongs to a separate reviewed Fleetrepo issue/worktree. Continue autonomously through work not blocked by later human UI/MVP review.
