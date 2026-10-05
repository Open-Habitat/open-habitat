---
created: 2026-09-20
updated: 2026-10-05
type: task
status: done
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 40
blocked_by: ['@build-workspace-slice']
collision: [docs/, AGENTS.md, design-system/]
closed: 2026-10-05
closed_by: jari
---

# Display native Pi history for the first working core

## Goal

Open a discovered conversation and render its real native history using production
components. Establish reliable identity, ordering and read-only behavior for the core;
@complete-conversation-ui delivers the full accepted tool/diff presentation.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), the accepted implementation
briefs, [architecture](../../docs/architecture.md) and [interfaces](../../docs/interfaces.md).

## Scope

Read native history without another history store. Do not launch or resume on read.
Use the accepted frontend and component library. Preserve the full conversation design
as the next UI task's responsibility; do not silently drop its features.

## Acceptance Criteria

- [x] Use namespaced native resume IDs and evidence-based workspace association, including histories without a live controllable process.
- [x] Render real message text/code and generic tool output with stable identity/order, safe content rendering and explicit unsupported event fallback.
- [x] Handle empty, unreadable and long histories according to the accepted loading bounds; expose read-only status honestly.
- [x] Show the same conversation after reopening, with no duplicate authoritative history.
- [x] Verify representative redacted Pi fixtures and a real disposable history with the accepted commands; record limitations for @complete-conversation-ui.

## Delivery

Save `result.md` here with demonstrated revision, commands and outcomes. Update affected
current docs and use the repository's shared validation/ownership rules.

## Bounded planning handoff

This issue owns Y3. Bind `pi:<sessionId>` and stable native keys to the real Pi JSONL source; distinguish history, process observation and control. Prove paging/chunk/live-tail limits, malformed and unknown content, missing/corrupt/moved-cwd cases and reopen identity against redacted plus disposable native histories. Opening never starts or resumes. See [the implementation briefs](../plan-v1-implementation/implementation-briefs.md).


## Visual evidence

Provide proportionate browser evidence and screenshots in
`issues/build-history-view/visual-acceptance.md`, with the tested revision,
environment and relevant outcomes. Record Jari's visual verdict when given;
unreviewed appearance remains unreviewed. A pending screenshot verdict does not
block functional completion or independent downstream work.

Interactive and repeated behavior must use the shared production component implementation. Local composition may arrange one-off content but may not invent controls, state semantics, focus rules or styling. When this production slice replaces a canonical/root mock or static reference, remove the superseded root/canonical reference in the same accepted change; an original may remain only in its receiving issue as historical evidence.

## Comments

### 2026-09-27T08:32:43Z · @claude

2026-09-27 conductor scheduling change: Jari asked this stint to advance the test environment and the UIs in parallel while he is away. The 2026-09-24 pilot-first ordering was a priority choice; deliver-login-pilot now waits on Jari's human-review readiness gate and Fleetrepo host activation, which this UI slice does not depend on technically. deliver-login-pilot moved to its own 'pilot' lane and its blocker edge was removed here. The visual acceptance gate was later relaxed by Jari's 2026-09-28 direction: continue agent functionality without waiting for this screenshot verdict; visual acceptance itself remains pending.

## Decisions

### 2026-09-28T12:42:36Z · @jari

2026-09-28: Do not block agent-functionality implementation on my history-view screenshot review. Keep this visual verdict pending and work pragmatically; technical dependencies and actual file collisions still matter.

## Resolution

### 2026-10-05T12:49:48Z · @jari

Jari has seen Pi conversations in the browser and considers the read-only history view delivered. The result.md tests and checked criteria document functional evidence; the screenshot comparison in visual-acceptance.md was not separately reviewed.
