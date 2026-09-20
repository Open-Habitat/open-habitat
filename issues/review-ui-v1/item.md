---
created: 2026-09-20
updated: 2026-09-20
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 10
blocked_by: ['@receive-designer-v1', '@finalize-design-docs']
---

# Review and agree the designer UI v1

## Goal

Review the delivered UI against the bounded v1 brief and agree the implementation target with Jari.

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

- [ ] Check B1–B10, B12 and B5a–B5f; B11 and L1–L13 must not become v1 requirements.
- [ ] Check host A1–A6, A8 and basic A9; ensure navigation and conversation form one usable flow.
- [ ] Walk through sending, resume, read-only agents, grouped tools, diffs, copy, supported questions, interruption and uncertain sends/reconnect.
- [ ] Record requested corrections, their resolution and explicit user acceptance of the implementation target.
- [ ] Record chosen UI components and unresolved adapter requirements; a mock does not prove Pi integration.
