---
created: 2026-09-20
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 40
blocked_by: ['@build-workspace-slice']
collision: [docs/, AGENTS.md, design-system/]
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

- [ ] Use namespaced native resume IDs and evidence-based workspace association, including histories without a live controllable process.
- [ ] Render real message text/code and generic tool output with stable identity/order, safe content rendering and explicit unsupported event fallback.
- [ ] Handle empty, unreadable and long histories according to the accepted loading bounds; expose read-only status honestly.
- [ ] Show the same conversation after reopening, with no duplicate authoritative history.
- [ ] Verify representative redacted Pi fixtures and a real disposable history with the accepted commands; record limitations for @complete-conversation-ui.

## Delivery

Save `result.md` here with demonstrated revision, commands and outcomes. Update affected
current docs and use the repository's shared validation/ownership rules.

## Bounded planning handoff

This issue owns Y3. Bind `pi:<sessionId>` and stable native keys to the real Pi JSONL source; distinguish history, process observation and control. Prove paging/chunk/live-tail limits, malformed and unknown content, missing/corrupt/moved-cwd cases and reopen identity against redacted plus disposable native histories. Opening never starts or resumes. See [the implementation briefs](../plan-v1-implementation/implementation-briefs.md).
