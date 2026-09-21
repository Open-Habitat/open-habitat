---
created: 2026-09-20
updated: 2026-09-20
type: task
status: deferred
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@verify-v1-resilience']
---

# Evaluate manual then automatic conversation recap

## Goal

Start with a user-requested recap card if returning to long conversations is difficult; consider automatic recap only after the manual path is useful.

## Context

Explicitly later, per the user's v1-first direction. Covers L7 in [the complete TUI follow-up list](../native-agent-host-architecture/ui-design-later.md). No executable lane: completing v1 does not automatically activate this work. Select and narrow the next useful feature with the user.

Sources: [architecture](../../docs/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Verify native recap support or explicitly design the missing integration, including cost and model-context separation.
- [ ] Show generation, age, failure and a suggested next step; do not replace history or automatically execute suggestions.
