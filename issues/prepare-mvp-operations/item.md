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

Make the functional MVP installable and recoverable on the approved target before final resilience verification and pilot acceptance.

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
- [ ] Exercise installation and rollback in a disposable environment and prepare two test identities plus representative workspaces for the pilot.
- [ ] Confirm target, command and deployment authorization from the recorded decision before touching Alder; missing authorization goes to the main conversation with a prepared reviewable change.
- [ ] Prepare the pilot procedure and cleanup/recovery instructions for @verify-v1-resilience; no production availability claim from packaging alone.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.
