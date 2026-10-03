---
created: 2026-09-21
updated: 2026-10-03
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 90
blocked_by: ['@connect-github-workspaces', '@decide-taskfleet-browser-integration']
collision: [docs/, AGENTS.md, design-system/]
---

# Manage agent worktrees

## Purpose

Make worktree agents first-class agents in Omega Habitat. A person can create
work from a Git workspace, find its agent in the workspace navigation, open
its conversation and work with it through the browser. Taskfleet is the chosen
implementation for creating and managing this native work.

The [integration design](../decide-taskfleet-browser-integration/item.md)
resolves the experience and the launch/control boundary. The current Taskfleet
flow starts a terminal agent, while the browser treats terminal agents as
read-only. Implement the agreed solution to that gap as part of this work;
creating a worktree and showing its history alone does not fulfil the goal.

## Native ownership and browser experience

Taskfleet owns its runs and worktrees, Git describes the checkout, and Pi owns
its conversation history. Connect those facts so the browser shows the actual
agent, its state and its relationship to the parent workspace. Incomplete
native information remains visible as uncertainty.

Use Taskfleet's supported creation inputs and show the resulting branch and
worktree. Taskfleet determines the final branch name. Availability depends on
the Git workspace and the installed Taskfleet capabilities; when creation is
unavailable, the user needs a reason they can act on.

Associate work with the full Taskfleet run/node identity. A branch name or
short display identifier cannot establish ownership and could select someone
else's work. Cleanup goes through Taskfleet. Manual worktrees and work without
a verified ownership match remain read-only and prevent destructive cleanup
that would affect them.

Worktree creation and agent startup can succeed separately. After a failure
or disconnect, show what exists, what is running and what remains uncertain,
so the user can continue from the actual result without unknowingly duplicating
work. The launch and control design determines how the agent becomes available
for interaction.

## Completion and evidence

Demonstrate the browser journey from creation to working with the agent, plus
recovery from interrupted or partially completed creation. Verify that native
ownership is respected during cleanup, including manual and unknown worktrees
([CT-019](../../contracts/v1/scenarios.json)). Use disposable Git, Taskfleet and
harness data: real sessions and their uncommitted work are valuable.

Use the shared [design](../../design-system/design.md) and production components.
Keep the [interface description](../../docs/interfaces.md),
[contracts](../../contracts/v1/AGENTS.md) and affected product documentation
consistent with the agreed integration. The product page's existing promise
of a user-chosen final branch name needs to reflect Taskfleet's actual behavior.

[TESTING.md](../../TESTING.md) defines the checks and browser evidence. Record
what was demonstrated and what remains unverified in this issue's result,
distinguishing native Taskfleet integration from simulated behavior.
