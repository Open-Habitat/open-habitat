---
created: 2026-09-21
updated: 2026-10-05
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 90
blocked_by: ['@connect-github-workspaces', '@decide-taskfleet-browser-integration']
collision: [docs/, AGENTS.md, design-system/]
preparation: reviewing
---

# Manage agent worktrees

A person can create work from a Git workspace in Omega Habitat, find its agent
under that workspace and work with it through the ordinary browser conversation
view. Calling agents can delegate to the same kind of child and wait for its
Taskfleet outcome in their own execution environment.

Implement the [integration design](../decide-taskfleet-browser-integration/design.md).
[ADR 0010](../../docs/decisions/adr-0010-taskfleet-worktree-agents.md) records the
agreed ownership: Taskfleet creates and settles runs and worktrees, the per-user
daemon controls a separate Pi child in the verified checkout, and Pi owns its
history. The design describes creation, state presentation, recovery and history
after cleanup; it is the source for those behaviors.

## What matters in this integration

Native identity connects the two owners: the full Taskfleet run/node identity
and verified checkout identify the work, and the durable Pi session binding
keeps its conversation findable after worktree removal. Branch names and display
fragments cannot establish ownership. Cleanup affects valuable uncommitted work,
so Taskfleet needs known ownership and remaining writers; manual and unknown
worktrees remain read-only and block destructive cleanup that would affect them.

Run creation, Pi startup and run settlement are separate outcomes. Showing what
exists and what remains uncertain lets a person recover from interruption or
daemon restart without duplicating work. Taskfleet run state alone says neither
that Pi is active nor that the browser controls it.

For delegation, the caller receives the exact run ID and starts
`taskfleet run wait <run-id>`. The child can progress and reach its Taskfleet
outcome while the caller is blocked there. Settlement that needs the caller to
act first would deadlock this workflow; Pi exiting is not settlement. Success,
failure, cancellation and timeout retain their native wait meanings.

## Implementation choices

Coordinate with Taskfleet's `caller-owned-agent-runs` issue for creation without
a terminal worker, supervision independent of the daemon service, recoverable
creation and durable session binding. The host needs this supported contract,
including the delegation workflow above. Jari clarified that this integration
has no workmux dependency: Taskfleet provisions and settles caller-owned runs
using its own Git operations. The older workmux placement suggestion in the
linked integration design is superseded, not an option to implement.

Choose supported worktree placement discoverable under `~/src`; the design
explains the layout mismatch. Outside and manual worktrees start as read-only
observations. Decide which merge, salvage and discard actions belong in the
browser, starting from native CLI settlement. These choices are delegated to
implementation within the agreed ownership boundary.

## Evidence

The result demonstrates browser creation and conversation control, recovery from
partial creation and daemon restart, and access to completed conversations after
cleanup. A real calling-agent `taskfleet run wait` process exercises the child
lifecycle across both owners, including success, failure, cancellation and
timeout. [CT-019](../../contracts/v1/scenarios.json) covers cleanup ownership.
Distinguish native integration from simulations and remaining gaps.

Use the shared [design](../../design-system/design.md) and production components,
with the [HTTP description](../../docs/architecture/http-api.md) and
[contracts](../../contracts/v1/AGENTS.md) reflecting the implemented behavior.
[TESTING.md](../../TESTING.md) owns checks and disposable test data;
[the design process](../../design-system/process.md) owns visual comparison.
Keep the tested revision, lab screenshots and static HTML in
`visual-acceptance.md`, recording Jari's verdict when given. Unreviewed appearance
does not block functional completion or independent work.
