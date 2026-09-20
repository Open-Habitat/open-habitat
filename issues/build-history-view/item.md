---
created: 2026-09-20
updated: 2026-09-20
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 40
blocked_by: ['@build-workspace-slice']
---

# Display native Pi history in the accepted UI

## Goal

Open a discovered agent conversation and show its native history in the v1 conversation view.

## Context

Follow the current Unix-native architecture and the bounded UI v1 brief.

Sources: [architecture](../../docs/site/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Use native namespaced resume IDs and honest workspace associations; reading must not start or resume an agent.
- [ ] Render text, code, compact tool groups, available unified diffs and generic fallback for unknown tools.
- [ ] Implement copy actions, long output handling, read-only states and history errors.
- [ ] Verify representative real Pi history with preserved tool identity/order and no duplicated authoritative history.
