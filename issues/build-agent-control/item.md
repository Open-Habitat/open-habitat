---
created: 2026-09-20
updated: 2026-09-20
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 50
blocked_by: ['@build-history-view']
---

# Connect v1 conversation controls to Pi

## Goal

Resume or launch Pi, send a prompt and display live work through the agreed HTTP/SSE interface.

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

- [ ] Implement acknowledged send, streaming updates, supported simple user requests and interruption with explicit pending/failure states.
- [ ] Do not duplicate a conversation already running elsewhere; show unsupported control honestly.
- [ ] Preserve drafts, focus and reading position while tool groups update; match the same history on reopening.
- [ ] Keep tool execution and configuration in Pi, with no process center or later-feature expansion.
- [ ] Demonstrate the accepted v1 story against a real test agent and run the checks specified by @plan-v1-implementation.
