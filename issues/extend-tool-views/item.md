---
created: 2026-09-20
updated: 2026-09-20
type: task
status: deferred
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@verify-v1-resilience']
---

# Extend diffs tool renderers and visual choices after v1

## Goal

Use actual v1 experience to choose richer diffs, specialized MCP/web/subtask rendering or theme/density options one at a time.

## Context

Explicitly later, per the user's v1-first direction. Covers L9–L11 in [the complete TUI follow-up list](../native-agent-host-architecture/ui-design-later.md). No executable lane: completing v1 does not automatically activate this work. Select and narrow the next useful feature with the user.

Sources: [architecture](../../docs/site/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Select one concrete improvement and split it into a bounded implementation issue before activation.
- [ ] Use real diff/event data; preserve order, errors and requests when grouping.
- [ ] Do not add approval of already-applied edits, speculative tool taxonomy or theme settings without a need.
