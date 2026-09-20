---
created: 2026-09-20
updated: 2026-09-20
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 30
blocked_by: ['@plan-v1-implementation']
---

# Build login to workspace navigation

## Goal

Implement the first end-to-end browser path through the gateway and per-user daemon to the real workspace directory list.

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

- [ ] Use the implementation choices and test commands established by @plan-v1-implementation.
- [ ] Authenticate a web identity, map it to one fixed Unix user and route to that user's daemon.
- [ ] List immediate ~/src directories including non-Git directories and directories without workspace metadata.
- [ ] Implement the accepted navigation and loading/empty/error views with no workspace registry or separate harness settings.
- [ ] Demonstrate the real end-to-end path and automated checks appropriate to routing and directory access.
