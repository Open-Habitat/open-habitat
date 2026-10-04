# ADR 0010: Taskfleet owns worktree runs, the daemon owns the browser's Pi

**Status:** Accepted; not implemented. Jari approved option B of the design
brief in [decide-taskfleet-browser-integration](../../issues/decide-taskfleet-browser-integration/item.md)
on 2026-10-04. [manage-agent-worktrees](../../issues/manage-agent-worktrees/item.md)
implements it, and Taskfleet's side is its issue `caller-owned-agent-runs`.

## The need

Worktree agents should be first-class agents in the browser: a person creates
work from a Git workspace, finds the agent under that workspace, opens its
conversation and works with it. Taskfleet is the chosen tool for creating and
settling runs and worktrees. Its normal worker is a Pi started in tmux, and
the browser can only read such a Pi, not control it, because Pi's RPC mode
cannot attach to a running terminal and the host's writer lock does not fence
a terminal process.

## Decision

Two owners, each with the authority it already has.

- Taskfleet creates the run, node and worktree and is the only thing that
  merges, cancels, salvages or discards them. Stopping Pi, closing the
  browser or losing the daemon is never a decision to merge or discard work.
- The per-user daemon starts and controls a separate Pi child in the verified
  checkout, exactly as it does for any browser conversation: its own lock,
  RPC channel and handle, under the same Unix user. No gateway or root process
  launches agents.

Taskfleet needs changes to support this environment, and Jari expects them:
a way to reserve a run and worktree without starting the terminal worker, a
supervisor lifetime outside the daemon's systemd control group so a daemon
restart does not kill runs, recoverable idempotency for interrupted creation,
and a durable run/node to Pi-session binding so a conversation stays findable
after the worktree is torn down.

The daemon admits a Pi child into a worktree only after proving that the
exact run and node identity, the checkout and a user-owned discovered
workspace match. A branch name or a short display identifier is not proof.

## Alternatives displaced

- The daemon invoking Taskfleet's existing CLI and showing its terminal
  worker read-only. That is a discovery slice, not an interactive agent.
- Taskfleet launching a worker with a browser-controllable RPC bridge to the
  daemon. More native parity with Taskfleet's ordinary workers, but a new
  control protocol between two process owners and more coupling. It remains
  the fallback if Taskfleet cannot reserve without starting a worker.
- The browser taking over a terminal worker. Not an option without changing
  Pi's semantics and proving a single writer first.

## Left to the implementation

Where worktrees are placed so the daemon can discover them under `~/src`,
with worktrees elsewhere shown read-only, and whether merge, salvage and
discard appear in the browser or stay in the native Taskfleet CLI. The design
brief's conservative assumptions are the starting point.
