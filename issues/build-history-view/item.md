---
created: 2026-09-20
updated: 2026-09-27
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


## Jari visual acceptance gate

This issue is both the executable delivery and its serial human checkpoint. The worker must leave it in `testing`, not close it. While a `ui-v1` issue is in `testing`, it is a non-launchable human-acceptance hold: no round may spawn, resume or close a worker for it. Before any later `ui-v1` lane member may treat its user-visible behavior as delivered, `issues/build-history-view/visual-acceptance.md` must record the exact product revision, browser/OS/environment, deterministic test fixtures, happy path and every relevant unhappy state, exact Playwright/test commands and results, and links to the essential Playwright screenshots. Screenshots are evidence, not a replacement for assertions. The conductor presents that report to Jari and records his explicit dated accept/change decision in this issue. Only the conductor may then close it; lane serialization keeps the next product slice behind this checkpoint without assigning a lane to a `human-review` issue or letting a worker self-accept.

Interactive and repeated behavior must use the shared production component implementation. Local composition may arrange one-off content but may not invent controls, state semantics, focus rules or styling. When this production slice replaces a canonical/root mock or static reference, remove the superseded root/canonical reference in the same accepted change; an original may remain only in its receiving issue as historical evidence.

## Comments

### 2026-09-27T08:32:43Z · @claude

2026-09-27 conductor scheduling change: Jari asked this stint to advance the test environment and the UIs in parallel while he is away. The 2026-09-24 pilot-first ordering was a priority choice; deliver-login-pilot now waits on Jari's human-review readiness gate and Fleetrepo host activation, which this UI slice does not depend on technically. deliver-login-pilot moved to its own 'pilot' lane and its blocker edge was removed here. The visual acceptance gate for this issue is unchanged. Reversible with issuectl update.
