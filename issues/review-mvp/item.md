---
created: 2026-09-21
updated: 2026-10-18
type: task
status: obsolete
priority: normal
labels: [human-review]
reviewer: jari
closed_by: jari
closed: 2026-09-28
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
- [ ] Update product/status/operations docs to distinguish delivered behavior from remaining limits. Confirm that accepted post-MVP UI work proceeds as design and review before any implementation is activated.

## Execution

This issue deliberately has no lane and carries `human-review`. The stint conductor handles it with Jari after its blockers deliver; never spawn it as a worker. If changes are requested, schedule bounded correction work and add it as a blocker. Keep this gate open until the actual decision is recorded.

## Resolution

### 2026-09-28T12:10:54Z · @jari

Jari no longer wants a fixed MVP completion boundary or a final whole-system acceptance gate. Continue the product through observation-by-observation review and corrections, including specific UI and safety checks in their own issues; do not treat closure as acceptance of unfinished functionality.
