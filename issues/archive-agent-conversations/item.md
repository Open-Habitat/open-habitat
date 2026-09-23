---
created: 2026-09-21
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 100
blocked_by: ['@manage-agent-worktrees']
collision: [docs/, AGENTS.md, design-system/]
---

# Archive native agent conversations

## Goal

Implement the accepted stop, archive and continue flow using native agent history.

## Context

Use the accepted workspace and conversation handoffs plus the Pi lifecycle evidence from @probe-pi-control.

## Scope

Do not create a parallel conversation history or Agent Host archive database. Archive state must map to a native capability or to the smallest explicitly justified workspace-local presentation metadata.

## Acceptance Criteria

- [ ] Stop an agent only when the adapter reports that browser control is available.
- [ ] Remove an archived conversation from the active list without deleting native history.
- [ ] List archived conversations per workspace and continue one through the supported native resume path.
- [ ] Preserve honest read-only behavior when history exists but control is unavailable.
- [ ] Verify stop/resume failures, disconnects and stale state without claiming success prematurely.

## Implementation and evidence

Use the [delivery plan](../plan-v1-implementation/plan.md), accepted implementation
briefs and exact checks verified by @build-app-foundation. Save `result.md` here with
the tested revision, commands, outcomes and remaining limits. Update the affected
durable documents and component examples; do not duplicate task state in TODO.md.

## Bounded planning handoff

This issue owns M6. Stop, archive annotation, unarchive and resume are separate observable operations. Prove active-writer conflict, annotation crash/corruption, missing history, stale/disconnect and same native resume ID; never copy or delete Pi history. See [the implementation briefs](../plan-v1-implementation/implementation-briefs.md).


## Jari visual acceptance gate

This issue is both the executable delivery and its serial human checkpoint. The worker must leave it in `testing`, not close it. While a `ui-v1` issue is in `testing`, it is a non-launchable human-acceptance hold: no round may spawn, resume or close a worker for it. Before any later `ui-v1` lane member may treat its user-visible behavior as delivered, `issues/archive-agent-conversations/visual-acceptance.md` must record the exact product revision, browser/OS/environment, deterministic test fixtures, happy path and every relevant unhappy state, exact Playwright/test commands and results, and links to the essential Playwright screenshots. Screenshots are evidence, not a replacement for assertions. The conductor presents that report to Jari and records his explicit dated accept/change decision in this issue. Only the conductor may then close it; lane serialization keeps the next product slice behind this checkpoint without assigning a lane to a `human-review` issue or letting a worker self-accept.

Interactive and repeated behavior must use the shared production component implementation. Local composition may arrange one-off content but may not invent controls, state semantics, focus rules or styling. When this production slice replaces a canonical/root mock or static reference, remove the superseded root/canonical reference in the same accepted change; an original may remain only in its receiving issue as historical evidence.
