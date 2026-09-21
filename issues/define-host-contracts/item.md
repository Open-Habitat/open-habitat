---
created: 2026-09-21
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: planning
lane_seq: 50
blocked_by: ['@choose-frontend-stack', '@choose-host-stack']
collision: [docs/, AGENTS.md]
---

# Specify browser daemon and native adapter contracts

## Goal

Specify observable behavior at component boundaries before implementation. Produce concrete contracts grounded in probe evidence and proposed stack decisions.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [ ] Complete `docs/interfaces.md` for identity, source ownership, discovery/status/control capability, history and operation results; place machine-readable schemas in the location chosen for the stack.
- [ ] Define HTTP snapshot/query/command/error shapes and combined SSE events: cursor identity, snapshot/stream race, ordering, replay bounds, duplicate handling and resnapshot.
- [ ] Specify send acceptance vs execution, uncertain acknowledgement, retry policy, command identity and concurrent browser/terminal resume ownership.
- [ ] Define start/resume/interrupt/stop/question/queue support from evidence; unsupported operations have explicit capability/error behavior.
- [ ] Define filesystem/path validation, authenticated routing, rendered-content trust and partial-failure semantics for workspace/GitHub/worktree/archive actions.
- [ ] Decide minimal annotation fields/locations and lifetimes for genuinely missing facts; retain native history and Git as authoritative.
- [ ] Supply redacted example exchanges and contract-test scenarios for implementation; record outstanding policy choices for @review-implementation-plan.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.
