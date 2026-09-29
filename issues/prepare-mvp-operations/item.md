---
created: 2026-09-21
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 110
blocked_by: ['@archive-agent-conversations']
collision: [docs/, AGENTS.md]
---

# Package the MVP and prepare its pilot operation

## Goal

Make releases installable and recoverable, with generic self-hosting guidance
and a verified procedure for the test installation.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [ ] Implement and verify the accepted package/service lifecycle and gateway-to-daemon account mapping without ad hoc persistent source installs.
- [ ] Document prerequisites, exact install/update/start/stop/rollback and live-version commands in `docs/operations.md`; make CI/package checks reproducible.
- [ ] Define ownership and backup/restore of native histories, workspace annotations and host configuration; show logs/health sufficient to diagnose failures without leaking credentials.
- [ ] Exercise installation and rollback in a disposable environment with synthetic identities and representative workspaces.
- [ ] Use Fleetrepo's current test-installation upgrade procedure and verified rollback path for the authorized test server; stop if its preflight fails.
- [ ] Prepare the pilot procedure and cleanup/recovery instructions for @verify-v1-resilience; no production availability claim from packaging alone.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.

## Bounded planning handoff

Build on the existing reproducible release packaging and neutral service
templates. Native Agent Host owns generic installation, configuration, update,
rollback, live-version and operator documentation. Fleetrepo owns the concrete
accounts, bindings, secrets, ingress and release selection for the test host.
Coordinate that work there and record its revision and observed outcome.

Verify install, repeated apply, update, failed activation and rollback in a
disposable environment. Preserve native history and credentials; test cleanup
removes only fixture-owned state. Exact live commands and receipts belong to
Fleetrepo's `infra/native-agent-host-test/RELEASE-UPGRADE.md`, not a copied shell
recipe in this repository. Test releases proceed under that procedure; a
production installation is a separate decision by Jari.
