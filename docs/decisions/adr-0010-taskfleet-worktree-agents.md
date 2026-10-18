# ADR 0010: Taskfleet owns worktree runs, the daemon owns the browser's Pi

**Status:** Accepted by Jari on 4 October 2026 in
[decide-taskfleet-browser-integration](../../issues/decide-taskfleet-browser-integration/item.md).

**Amended by [ADR 0017](adr-0017-observe-taskfleet-spinoffs.md)** on 16 October
2026: observe Taskfleet-owned spinoffs read-only; caller-owned browser agents
are deferred.

**Amended by [ADR 0025](adr-0025-worktree-as-a-place.md)** on 18 October
2026: browser worktree agents do not use Taskfleet runs. A worktree is a plain
Git place that holds ordinary browser conversations, agents settle it in
conversation, and the daemon cleans worktrees up. The daemon still owns the
browser's Pi; the Taskfleet ownership and settlement below no longer apply to
worktrees a person creates in the browser. The original decision follows.

A person should be able to create a worktree agent and work with it in the
browser. Taskfleet's terminal worker cannot provide that experience because
Pi's RPC interface cannot attach to a terminal session.

Taskfleet owns the run, node, worktree and their settlement. The per-user
daemon starts and controls a separate Pi child in the verified checkout,
using its existing Unix identity, ownership lock and RPC control. Pi owns
its history. Launch requires an exact run/node/checkout match to the user's
workspace; a branch name alone does not establish ownership.

This reuses both components' responsibilities. A bridge to a Taskfleet-launched
worker would require a new control protocol between process owners.
Taskfleet needs creation without a terminal worker, recoverable retries and
a durable run/node-to-Pi-session binding for history after worktree removal.
Its supervisor must survive daemon restarts: process detachment alone does
not escape the daemon's systemd control group. Losing the daemon, stopping Pi
or closing the browser does not settle the run.

[Manage agent worktrees](../../issues/manage-agent-worktrees/item.md) and
Taskfleet's `caller-owned-agent-runs` implement the decision. The
[integration design](../../issues/decide-taskfleet-browser-integration/design.md)
leaves placement under `~/src` and browser settlement actions to implementation.
