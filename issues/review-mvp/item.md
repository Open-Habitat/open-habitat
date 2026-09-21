---
created: 2026-09-21
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
labels: [human-review]
reviewer: jari
blocked_by: ['@verify-v1-resilience']
---

# Review the complete desktop MVP and pilot results with Jari

## Goal

Human acceptance of the working system after the full accepted functionality and operational checks have been demonstrated. A core conversation demo alone cannot satisfy this gate.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [ ] Walk Jari through login, discovery, history/live control, workspace lifecycle, GitHub, worktree, archive/continue and recovery on the verified target.
- [ ] Review two-user isolation, restart/reconnect, native terminal compatibility and install/update/recovery evidence from @verify-v1-resilience.
- [ ] Record actual pilot feedback and unresolved defects with affected scenarios; blocking defects remain dependencies until verified fixes land.
- [ ] Record Jari's acceptance or requested corrections with date, demonstrated revision and known limitations; close only on acceptance.
- [ ] Update product/status/operations docs to distinguish delivered behavior from remaining limits. Do not activate deferred features merely because MVP is accepted.

## Execution

This issue deliberately has no lane and carries `human-review`. The stint conductor handles it with Jari after its blockers deliver; never spawn it as a worker. If changes are requested, schedule bounded correction work and add it as a blocker. Keep this gate open until the actual decision is recorded.
