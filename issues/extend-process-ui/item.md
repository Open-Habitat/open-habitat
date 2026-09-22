---
created: 2026-09-20
updated: 2026-09-22
type: task
status: open
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@review-mvp']
lane: post-mvp-design
lane_seq: 40
collision: [docs/, design-system/]
---

# Extend process visibility and controls after v1

## Goal

Start with read-only extension process inventory and one retained/live log. Split subsequent control, dock/status bar and watcher work into bounded issues before implementation. Preserve per-agent/extension process ownership and HTTP/SSE; no new process service.

## Context

This is accepted post-MVP design work covering L1–L5 in [the complete TUI follow-up list](../native-agent-host-architecture/ui-design-later.md). Begin by designing and reviewing the first useful process experience from observed MVP use; do not activate the broad implementation surface as one feature.

Sources: [architecture](../../docs/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Produce and review a concrete design for the first selected process feature before any implementation issue is activated.
- [ ] Choose the first useful process feature based on v1 use; define and verify its extension contract.
- [ ] Split L1–L5 into individually reviewable work before activating them.
- [ ] Cover inventory, logs/search/stream filters, control/stdin/clear, pinning/dock and notification/watch modes only where native support and a real need exist.
