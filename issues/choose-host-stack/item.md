---
created: 2026-09-21
updated: 2026-09-22
type: task
status: done
priority: normal
epic: native-agent-host-architecture
lane: planning
lane_seq: 40
blocked_by: ['@review-ui-v1', '@choose-frontend-stack', '@probe-workspace-lifecycle']
collision: [docs/, AGENTS.md]
closed: 2026-09-22
closed_by: pi
---

# Propose the gateway daemon and deployment stack

## Goal

Choose the smallest implementation of the accepted Unix-native architecture, compatible with the proposed browser stack. No installation or live deployment in this task.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [x] Recommend daemon language/runtime, Pi adapter/process ownership, gateway authentication, Unix account mapping, daemon transport and service packaging.
- [x] Define native tool/credential prerequisites, sign-in/out/session expiry, routing trust and failure behavior; credentials stay out of the browser.
- [x] Describe process survival across browser loss and daemon restart, supported terminal attachment, and testable limits.
- [x] Propose a disposable test environment and Alder pilot target, installation/update/rollback approach and Fleetrepo-owned persistent CLI installation where applicable.
- [x] Record deployment commands, required permissions and what needs approval in @review-implementation-plan; do not treat a host name as deployment permission.
- [x] Write a proposed ADR and operational recommendation, with verification strategy for two Unix users and safe negative tests; register in `docs/decisions.md`.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.
