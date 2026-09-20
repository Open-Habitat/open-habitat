---
created: 2026-09-20
updated: 2026-09-20
type: task
status: deferred
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@verify-v1-resilience']
---

# Extend process visibility and controls after v1

## Goal

Start with read-only extension process inventory and one retained/live log. Split subsequent control, dock/status bar and watcher work into bounded issues before implementation. Preserve per-agent/extension process ownership and HTTP/SSE; no new process service.

## Context

Explicitly later, per the user's v1-first direction. Covers L1–L5 in [the complete TUI follow-up list](../native-agent-host-architecture/ui-design-later.md). No executable lane: completing v1 does not automatically activate this work. Select and narrow the next useful feature with the user.

Sources: [architecture](../../docs/site/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Choose the first useful process feature based on v1 use; define and verify its extension contract.
- [ ] Split L1–L5 into individually reviewable work before activating them.
- [ ] Cover inventory, logs/search/stream filters, control/stdin/clear, pinning/dock and notification/watch modes only where native support and a real need exist.
