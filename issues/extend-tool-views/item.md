---
created: 2026-09-20
updated: 2026-09-22
type: task
status: open
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@review-mvp']
lane: post-mvp-design
lane_seq: 50
collision: [docs/, design-system/]
---

# Extend diffs tool renderers and visual choices after v1

## Goal

Use actual v1 experience to choose richer diffs, specialized MCP/web/subtask rendering or theme/density options one at a time.

## Context

This is accepted post-MVP design work covering L9–L11 in [the complete TUI follow-up list](../native-agent-host-architecture/ui-design-later.md). Begin by designing one evidence-backed renderer or visual refinement from observed MVP use; do not activate a bundle of speculative views or implementation before that design is reviewed.

Sources: [architecture](../../docs/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Produce and review a concrete visual/interaction design for the selected improvement before any implementation issue is activated.
- [ ] Select one concrete improvement and split it into a bounded implementation issue before activation.
- [ ] Use real diff/event data; preserve order, errors and requests when grouping.
- [ ] Do not add approval of already-applied edits, speculative tool taxonomy or theme settings without a need.
