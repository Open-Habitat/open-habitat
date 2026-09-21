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
