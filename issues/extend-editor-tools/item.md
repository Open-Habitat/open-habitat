---
created: 2026-09-20
updated: 2026-09-20
type: task
status: deferred
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@verify-v1-resilience']
---

# Evaluate command completion and editor shortcuts after v1

## Goal

Begin with native command discovery and midline slash completion if useful. Treat double-Escape and alternate copying modes as browser-specific candidates, not mandatory TUI ports.

## Context

Explicitly later, per the user's v1-first direction. Covers L6, L12 in [the complete TUI follow-up list](../native-agent-host-architecture/ui-design-later.md). No executable lane: completing v1 does not automatically activate this work. Select and narrow the next useful feature with the user.

Sources: [architecture](../../docs/site/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Verify command listing and execution support, insertion at cursor, descriptions and source labels.
- [ ] Preserve selection, IME, undo and browser shortcuts; add copy modes or quick clear only for an observed need.
