---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: taskfleet:01m51nrfvbqwsybz0gdggz6q4b/request:implement-spinoff-agents
originating_run: 01m51nrfvbqwsybz0gdggz6q4b
originating_run_kind: spinoff
preparation: ready
blocked_by: ['@implement-workspace-page']
collision: [web/src/app/, web/src/components/, internal/daemon, contracts/v1]
lane: web
lane_seq: 5
---

# Implement read-only spinoff agents in the parent thread

## Description

## Goal

Implement Jari's accepted direction 1, **Langassa**, from
@proto-spinoff-agents: an agent starts its own Taskfleet spinoffs, and the
person observes them in the parent conversation and speaks only to the parent.
Use **spinoff** or **spinoff-agentti**, not a new synonym.

[ADR 0017](../../docs/decisions/adr-0017-observe-taskfleet-spinoffs.md) records
the authority decision. The [architecture](../manage-agent-worktrees/architecture.md)
contains the integration detail; the [prototype result](../proto-spinoff-agents/result.md)
and `design-system/prototypes/rounds/2026-10-16-spinoffit/` supply the chosen view.
This replaces the earlier browser-controlled worktree-agent implementation
scope in @manage-agent-worktrees. Caller-owned runs are deferred.

## Experience

Show a live-updating spinoff group where the parent started the work in its
thread, with working, waiting-for-parent, merged and unmerged/preserved results.
Opening a spinoff shows its own transcript and result read-only, with a route
back to the parent instead of a composer. Settlement and all messages go
through the parent; no browser merge/cancel/discard or spinoff continuation.

Jari's additions (2026-10-16): show the spinoff state in the **status line above
the composer**. For **Odottaa spinoffia**, use a **blinking right-hand dot**,
especially in the sidebar. Direction 1 does not add spinoff child rows to the
sidebar or workspace page: the parent carries the waiting state there.

The parent waits natively through a `taskfleet run wait` process; the process
extension wakes it. Derive Odottaa spinoffia only after the Pi turn has ended
and a recognized wait is live. The person can still write. During a running
turn it is Työskentelee. Match only structured literal wait commands, never
process names or inferred prose. Coordinate with @proto-processes-blocks and
@extend-process-ui for the process inventory, wait recognition and wake-up rows.

## Native integration

The daemon adds creator-session attribution when launching Pi and reads only
the user's own Taskfleet run records, native transcripts and Git results.
Validate exact run/session/workspace identity and transcript headers with
state-root-anchored reads. Attribution is display grouping, not authorization.
No host registry/history store and no injected messages into the parent.
Taskfleet worktrees remain outside ordinary workspace discovery. Unsupported
harness transcripts show the result with an explicit limitation.

## Dependencies and requested scheduling

Cross-repository blockers in **jarimustonen/taskfleet** (issuectl cannot model
these edges):

- `created-by-session`: creator conversation association, replay and clearing stale worker inheritance.
- `run-transcript-paths`: node/session identity and live/evidence transcript paths.
- `terminal-run-history-contract`: retained terminal records/reports after teardown (reuses existing evidence/retention work).
- `linux-independent-user-unit`: supervisor/worker outside the daemon cgroup and a reachable runtime-directory tmux socket.

Verify the supported Taskfleet release contains these contracts before claiming
browser-started spinoffs work. Fleetrepo must provide a running per-user systemd
manager (lingering). `caller-owned-agent-runs` is not a blocker.

Requested placement: lane **web**, after @implement-workspace-page; collisions
`web/src/app/`, `web/src/components/`, `internal/daemon`, `contracts/v1`.
This worker files unlaned for the later human lane-or-close decision under its
run policy; this paragraph preserves Jari's scheduling request.

## Acceptance Criteria

- [ ] Real Taskfleet children appear under the correct parent in direction 1 and open read-only; another Unix user's runs and transcripts are unreachable.
- [ ] Status above the composer and the sidebar's blinking right-hand dot distinguish Odottaa spinoffia from working and waiting for the person; parent messaging remains possible.
- [ ] Native wait completion wakes the parent without browser-authored history; interactive merge requested through the parent updates the view.
- [ ] Merged results and transcripts survive teardown; failed/preserved and unknown states remain honest, with copyable recovery commands rather than browser settlement.
- [ ] Browser-started workers survive a daemon restart; workspace discovery does not list their worktrees as workspaces.
- [ ] Contracts and architecture describe implemented behavior; production/Storybook components and light/dark/phone visual evidence follow TESTING.md and the design process.
