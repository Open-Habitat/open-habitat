---
created: 2026-09-20
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 100
blocked_by: ['@build-agent-control', '@archive-agent-conversations']
---

# Verify reconnect and two-user separation for v1

## Goal

Make the working prototype reliable enough to evaluate with real users and decide its first follow-up.

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

- [ ] Browser loss does not stop the agent; reconnect resumes events or fetches a fresh snapshot without duplicate messages.
- [ ] A send interrupted before acknowledgement remains uncertain until reconciled; it is not automatically resent.
- [ ] Daemon restart, stale observations and missing native sources produce honest recoverable UI states.
- [ ] Test two distinct Linux accounts and negative cross-user routing/access cases with an agreed test setup.
- [ ] Verify continued SSH/tmux/native Pi use within the attachment limits established by the probe.
- [ ] Walk through desktop/mobile v1 with Jari and record remaining defects and the observed need for the next feature.
