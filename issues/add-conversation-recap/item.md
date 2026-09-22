---
created: 2026-09-20
updated: 2026-09-22
type: task
status: open
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@review-mvp']
lane: post-mvp-design
lane_seq: 10
collision: [docs/, design-system/]
---

# Evaluate manual then automatic conversation recap

## Goal

Start with a user-requested recap card if returning to long conversations is difficult; consider automatic recap only after the manual path is useful.

## Context

This is accepted post-MVP design work covering L7 in [the complete TUI follow-up list](../native-agent-host-architecture/ui-design-later.md). Begin by designing the manual recap experience from observed MVP use; do not start implementation from the old sketch or treat automatic recap as already selected.

Sources: [architecture](../../docs/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Produce and review a concrete interaction design before any implementation issue is activated.
- [ ] Verify native recap support or explicitly design the missing integration, including cost and model-context separation.
- [ ] Show generation, age, failure and a suggested next step; do not replace history or automatically execute suggestions.
