# Worktree agents in the browser

A person creates work from a Git workspace, finds its agent under that workspace
and works with it through the ordinary browser conversation view. Taskfleet
manages the run and worktree; the per-user daemon starts and controls Pi there.
Jari approved this division on 4 October 2026.
[ADR 0010](../../docs/decisions/adr-0010-taskfleet-worktree-agents.md) records
the decision and its reasons. This document describes the intended experience
and the implementation choices it leaves open.

## Creating and finding work

The person supplies a task and title from a Git workspace. Taskfleet determines
the final branch and worktree name. Creation availability reflects the installed
Taskfleet capabilities and whether the resulting checkout can be opened safely
by the daemon. When creation is unavailable, the browser explains why.

The worktree agent appears under its parent workspace with its branch and a
way to open the worktree's own context. It has a separate working directory,
Pi session and history. Its conversation uses the ordinary browser controls.
Taskfleet run state, Pi activity and browser control availability describe
different things: a running Taskfleet run alone does not mean Pi is working
or that the browser can control it. Richer profile and worker telemetry belongs
to [expose-native-status](../expose-native-status/item.md).

Worktrees started elsewhere can be shown through the native facts available
to the host. Terminal conversations remain read-only. If a worktree is outside
the host's accessible workspace area, its run information can still explain
that limitation; it does not promise access to the conversation there.

## Calling agents and waiting for work

A calling agent must be able to delegate work to a browser-controlled worktree
agent and start a working `taskfleet run wait <run-id>` process in its native
execution environment. It receives the exact Taskfleet run identity and can
wait for the outcome through Taskfleet's ordinary CLI. This is a core agent
workflow alongside creation by a person in the browser.

The child work and Taskfleet lifecycle must continue while the caller waits.
The wait command observes Taskfleet run settlement, not merely Pi process exit.
The integration therefore needs a supported path for reporting and settling
the child run without requiring an action from the caller blocked in `wait`.
A browser-only completion indicator would leave that caller waiting. Successful,
failed and cancelled runs must remain observable through the normal wait result;
a timeout remains distinct from completion. Taskfleet retains lifecycle authority.

## Creation failures and returning to work

Run creation, worktree creation and Pi startup can succeed separately. After
a failed or interrupted request, the browser shows what exists and what is
still uncertain. Recovery uses Taskfleet's exact run/node identity and its
supported retry semantics, so a lost reply does not create duplicate work.
A worktree whose Pi failed to start remains a recoverable result.

The daemon starts Pi only in a verified checkout belonging to the identified
run and node. It uses its existing conversation ownership and continuation
rules. A daemon restart can end the browser Pi and lose its control handle;
surviving Taskfleet state or Pi history alone does not restore control.
Taskfleet's supervisor needs a lifetime independent of the daemon's service.
The current service uses `KillMode=mixed`, so detaching a child process alone
would still leave it subject to service cleanup.

Stopping the conversation and settling the run have different effects.
Taskfleet performs merge, cancellation, salvage and disposal. Before a checkout
is merged or removed, its ownership and remaining writers must be known so
active work is not lost. Manual worktrees and uncertain ownership allow
inspection, not destructive cleanup.

Completed work should retain a findable conversation and the Taskfleet report.
Pi keeps its native history, but the host currently associates that history
with an existing discovered workspace by its exact `cwd`. Removing the worktree
can therefore hide the conversation from the browser. A durable binding in
Taskfleet from run/node to Pi session, together with a safe host read path,
is needed to keep it accessible after cleanup.

## Choices for implementation

The daemon currently discovers immediate directories under `~/src`.
The 3 October investigation of Taskfleet 0.11.6 and workmux found that the
default sibling worktree layout nests checkouts one level deeper; workmux's
`worktree_dir` configuration may provide suitable placement. Implementation
must establish supported placement and discovery without relocating or adopting
existing work. The starting scope is creation in discoverable workspaces under
`~/src`, with outside and manual worktrees available only for inspection.

Implementation also decides whether merge, salvage and discard are exposed in
the browser. Leaving them in the native Taskfleet CLI is the conservative
starting point. Either presentation uses Taskfleet's lifecycle and makes clear
when work awaits settlement. These choices were delegated to
[manage-agent-worktrees](../manage-agent-worktrees/item.md); the launch/control
boundary is already decided.

## Implementation sources

Taskfleet's `issues/caller-owned-agent-runs/item.md` tracks creation without a
terminal worker, independent supervision, recoverable creation and session
binding, including compatibility with the calling agent’s native wait workflow.
The host implementation coordinates with that supported contract;
its behavior cannot be inferred from the old terminal-worker CLI alone.

The original investigation used Taskfleet 0.11.6 CLI help and workmux's
configuration reference. Current host behavior is described in
[workspaces](../../docs/architecture/workspaces.md) and
[conversations](../../docs/architecture/conversations.md), with discovery,
history association and Pi control implemented in `internal/daemon/`.
The integration's browser behavior and recovery evidence belong to
[manage-agent-worktrees](../manage-agent-worktrees/item.md).
