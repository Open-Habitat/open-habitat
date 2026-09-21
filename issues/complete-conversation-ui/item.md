---
created: 2026-09-21
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 60
blocked_by: ['@build-agent-control']
collision: [docs/, AGENTS.md, design-system/]
---

# Complete the accepted conversation and navigation experience

## Goal

Expand the working core into the full accepted conversation UI, using real adapter capabilities and the production component library.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [ ] Complete compact tool groups, code copying, supported simple diffs, unknown-tool fallback and bounded long-output/history behavior.
- [ ] Complete supported user questions, interruption and queue/steering behavior only as accepted in the contract; expose unsupported controls honestly.
- [ ] Preserve per-agent drafts, focus, reading position and route selection while events stream and agents change.
- [ ] Complete loading/empty/error/read-only, expired-login, stale status and uncertain-send/reconnect interactions across both design packages.
- [ ] Verify the agreed desktop/theme scope and component accessibility against real redacted Pi samples and a live disposable agent.
- [ ] Deliver a reviewable demonstration and record design corrections; process center, mobile and richer post-MVP tooling remain out of scope.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.
