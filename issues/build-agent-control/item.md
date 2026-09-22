---
created: 2026-09-20
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 50
blocked_by: ['@build-history-view']
collision: [docs/, AGENTS.md, design-system/]
---

# Connect v1 conversation controls to Pi

## Goal

Resume or launch Pi, send a prompt and display live work through the agreed HTTP/SSE interface.

## Context

Follow the current Unix-native architecture and the bounded UI v1 brief.

Sources: [architecture](../../docs/architecture.md),
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

## Implementation and evidence

Use the [delivery plan](../plan-v1-implementation/plan.md), accepted implementation
briefs and exact checks verified by @build-app-foundation. Save `result.md` here with
the tested revision, commands, outcomes and remaining limits. Update the affected
durable documents and component examples; do not duplicate task state in TODO.md.

This completes the first working core: demonstrate real login → workspace → native
history → start/resume → prompt → live response → browser disconnect/reconnect.
An uncertain send must not be automatically resent; closing the browser must not stop
the agent. Verify ownership against a concurrent resume attempt within the probe's limits.
Record the demo for Jari; it is an intermediate result, not full-MVP acceptance.
@complete-conversation-ui owns the remaining rich interaction and presentation work.

## Bounded planning handoff

This issue owns Y4–Y5 and completes the walking core. Prove one writer, start/ended-session resume, known-owner terminal transfer, accepted/rejected/uncertain send, SSE replay/resnapshot/backpressure, browser disconnect survival and daemon-crash child/history settlement. Implement CG-04 question cancellation only when adapter-proved; no hidden retry or live TUI attach. Exact CT/commands are in [the implementation briefs](../plan-v1-implementation/implementation-briefs.md).
