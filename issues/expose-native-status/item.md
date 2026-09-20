---
created: 2026-09-20
updated: 2026-09-20
type: task
status: deferred
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@verify-v1-resilience']
---

# Expose native task profiles and worker information when needed

## Goal

Show component-owned task profile/model changes and reliable Taskfleet/tmux bindings when a real user workflow needs them. Do not invent a profile configuration layer or browser-owned agent identity.

## Context

Explicitly later, per the user's v1-first direction. Covers L8, L13 in [the complete TUI follow-up list](../native-agent-host-architecture/ui-design-later.md). No executable lane: completing v1 does not automatically activate this work. Select and narrow the next useful feature with the user.

Sources: [architecture](../../docs/site/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Verify native profile commands and telemetry interpretation, including unknown/stale states.
- [ ] Distinguish worker lifecycle, conversation availability and browser controllability; only add controls supported by the source.
