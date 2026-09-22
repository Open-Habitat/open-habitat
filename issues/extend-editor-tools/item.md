---
created: 2026-09-20
updated: 2026-09-22
type: task
status: open
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@review-mvp']
lane: post-mvp-design
lane_seq: 30
collision: [docs/, design-system/]
---

# Evaluate command completion and editor shortcuts after v1

## Goal

Begin with native command discovery and midline slash completion if useful. Treat double-Escape and alternate copying modes as browser-specific candidates, not mandatory TUI ports.

## Context

This is accepted post-MVP design work covering L6 and L12 in [the complete TUI follow-up list](../native-agent-host-architecture/ui-design-later.md). Begin by designing the browser-native command and editor experience from observed MVP use; do not port TUI gestures or start implementation before that design is reviewed.

Sources: [architecture](../../docs/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Produce and review a concrete command/editor interaction design before any implementation issue is activated.
- [ ] Verify command listing and execution support, insertion at cursor, descriptions and source labels.
- [ ] Preserve selection, IME, undo and browser shortcuts; add copy modes or quick clear only for an observed need.
