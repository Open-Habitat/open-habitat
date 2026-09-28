---
created: 2026-09-20
updated: 2026-09-28
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: agent-control
lane_seq: 50
collision: [docs/, AGENTS.md, design-system/, internal/daemon/, web/src/components/Conversation.tsx]
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


## Visual review, without blocking useful work

Implement and verify working agent controls without waiting for Jari's separate history-view screenshot verdict. Preserve the production-component, native-session and browser evidence in `visual-acceptance.md`: exact revision, environment and commands, representative happy and important failure states, and screenshots. Leave this issue in `testing` for Jari's visual verdict after the functional slice lands; do not treat its unreviewed appearance as accepted. Continue independent downstream work where technical dependencies and file collisions permit. The conductor records Jari's decision here and closes this issue when accepted.

Interactive and repeated behavior must use the shared production component implementation. Local composition may arrange one-off content but may not invent controls, state semantics, focus rules or styling. When this production slice replaces a canonical/root mock or static reference, remove the superseded root/canonical reference in the same accepted change; an original may remain only in its receiving issue as historical evidence.

## Decisions

### 2026-09-28T12:42:36Z · @jari

2026-09-28: Proceed with agent functionality now; make the visual-review condition a principle of proportionate evidence rather than a blocking checkpoint. This does not approve the history view or waive functional tests.

### 2026-09-28T16:32:45Z · @jari

2026-09-28: First test-version process/interruption scope approved. The mapped UID daemon owns the direct Pi RPC child and bounds input writes, acknowledgements and shutdown waits; service-level systemd cleanup applies on daemon stop/crash. A native tool detached by Pi may outlive a single-controller cancel, so browser interruption is best-effort, never represented as confirmed until native state is reconciled. An uncertain send or termination is shown as uncertain and never retried automatically; do not launch another writer into unresolved work. A per-controller delegated cgroup or general supervisor is NOT a prerequisite for v1. Preserve ordinary UID isolation and honest restart/reconnect status. Update ADR 0003 and relevant tests in implementation; reconsider stronger containment only on observed need.
