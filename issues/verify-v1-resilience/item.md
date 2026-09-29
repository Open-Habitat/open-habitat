---
created: 2026-09-20
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 120
blocked_by: ['@archive-agent-conversations', '@complete-conversation-ui', '@prepare-mvp-operations']
collision: [docs/, AGENTS.md, design-system/]
---

# Verify reconnect and two-user separation for v1

## Goal

Make the working prototype reliable enough to evaluate with real users and decide its first follow-up.

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

- [ ] Browser loss does not stop the agent; reconnect resumes events or fetches a fresh snapshot without duplicate messages.
- [ ] A send interrupted before acknowledgement remains uncertain until reconciled; it is not automatically resent.
- [ ] Daemon restart, stale observations and missing native sources produce honest recoverable UI states.
- [ ] Test two distinct Linux accounts and negative cross-user routing/access cases with an agreed test setup.
- [ ] Verify independent SSH/tmux/native Pi use and read-only terminal histories; do not require browser takeover or simultaneous writers to one conversation.
- [ ] Walk through desktop v1 with Jari and record remaining defects and the observed need for the next feature.

## Implementation and evidence

Use the [delivery plan](../plan-v1-implementation/plan.md), accepted implementation
briefs and exact checks verified by @build-app-foundation. Save `result.md` here with
the tested revision, commands, outcomes and remaining limits. Update the affected
durable documents and component examples; do not duplicate task state in TODO.md.

Exercise delivered workspace/GitHub/worktree/archive flows, partial failures,
daemon restart, native history recovery and independent SSH/tmux/Pi use. Use two
synthetic Unix users for automated isolation tests. Live participants choose to
sign in themselves; a second person's participation is not a prerequisite for
technical verification. Follow Fleetrepo's current test-installation procedure
for live checks and record their limits separately from synthetic evidence.
Report findings for focused fixes and review as they arise.

## Bounded planning handoff

Use the current [contract scenarios](../../contracts/v1/scenarios.json) and
feature results to select integration tests. Exercise browser/SSE/gateway/daemon
failure and package update/rollback where the environment can prove them.
Check cross-user denial, preserved native data and absence of silent duplicate
sends. Measure realistic long-history and streaming workloads; adjust useful
limits instead of building machinery to meet arbitrary numbers. This work
produces evidence and fixes, not a final MVP acceptance checkpoint.
