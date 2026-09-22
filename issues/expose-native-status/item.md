---
created: 2026-09-20
updated: 2026-09-22
type: task
status: open
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@review-mvp']
lane: post-mvp-design
lane_seq: 20
collision: [docs/, design-system/]
---

# Expose native task profiles and worker information when needed

## Goal

Show component-owned task profile/model changes and reliable Taskfleet/tmux bindings when a real user workflow needs them. Do not invent a profile configuration layer or browser-owned agent identity.

## Context

This is accepted post-MVP design work covering L8 and L13 in [the complete TUI follow-up list](../native-agent-host-architecture/ui-design-later.md). Begin by designing the smallest useful native-status experience from observed MVP use; do not expose every available field or add implementation before that design is reviewed.

Sources: [architecture](../../docs/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Produce and review a concrete information and interaction design before any implementation issue is activated.
- [ ] Verify native profile commands and telemetry interpretation, including unknown/stale states.
- [ ] Distinguish worker lifecycle, conversation availability and browser controllability; only add controls supported by the source.
