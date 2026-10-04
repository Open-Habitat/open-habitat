---
created: 2026-09-21
updated: 2026-10-04
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

Make worktree agents first-class agents in Omega Habitat. A person creates
work from a Git workspace, finds its agent under that workspace, opens its
conversation and works with it through the browser.

Implement the [integration design](../decide-taskfleet-browser-integration/design.md)
and the ownership division accepted in
[ADR 0010](../../docs/decisions/adr-0010-taskfleet-worktree-agents.md): Taskfleet
creates and settles the run and worktree, while the per-user daemon starts and
controls a separate Pi child in the verified checkout. Creating a worktree and
showing terminal history alone does not fulfil the goal.

## Native ownership and browser experience

Taskfleet owns its runs and worktrees, Git describes the checkout, and Pi owns
its conversation history. Connect those facts so the browser shows the agent,
its state and its relationship to the parent workspace. Missing native facts
remain visible as uncertainty; run state alone does not establish Pi activity
or browser control.

Use Taskfleet's supported creation inputs and show the resulting branch and
worktree. Taskfleet determines the final branch name. When creation is
unavailable, show a reason the person can act on.

Associate work with the full Taskfleet run/node identity and verified checkout.
A branch name or short display identifier could select someone else's work.
Taskfleet performs cleanup once ownership and remaining writers are known.
Manual worktrees and work without verified ownership remain read-only and
prevent destructive cleanup that would affect them.

Worktree creation and agent startup can succeed separately. After a failure,
disconnect or daemon restart, show what exists, what is running and what remains
uncertain, so the person can recover without duplicating work. Stopping Pi
does not settle the run. Keep completed conversations findable through the
native run/node-to-Pi-session binding, including after worktree removal.

Calling agents also need the native delegation workflow: create the child work,
obtain its exact run ID and start `taskfleet run wait` in their own execution
environment. The child must keep progressing and reach its Taskfleet outcome
while the caller waits. Settlement cannot depend on that blocked caller acting
first; Pi process exit alone does not settle the run. Preserve Taskfleet's wait
results for completion, failure, cancellation and timeout.

## Taskfleet support and implementation choices

Taskfleet's `caller-owned-agent-runs` issue owns the support needed for this
division: creation without a terminal worker, a supervisor independent of the
daemon service, recoverable creation and durable session binding. Coordinate
the host integration with that contract.

Resolve worktree placement so the daemon can discover created work under
`~/src`; outside and manual worktrees start as read-only observations.
The integration design explains the mismatch with the default nested worktree
layout. Also decide which merge, salvage and discard actions belong in the
browser, starting from native CLI settlement. These are implementation choices;
the Taskfleet/daemon ownership boundary has been decided.

## Completion and evidence

Demonstrate the browser journey from creation to working with the agent,
recovery from partial creation and daemon restart, and finding completed
conversations after cleanup. Also demonstrate a calling agent starting a real
`taskfleet run wait` process while the daemon-controlled child works, then
receiving its Taskfleet outcome. Cover failure, cancellation and timeout as
well as success, so this proves the native wait contract across both owners.
Verify native ownership during cleanup, including manual and unknown worktrees
([CT-019](../../contracts/v1/scenarios.json)).
Use disposable Git, Taskfleet and harness data: real sessions and their
uncommitted work are valuable.

Use the shared [design](../../design-system/design.md) and production components.
Keep the [interface description](../../docs/architecture/http-api.md),
[contracts](../../contracts/v1/AGENTS.md) and affected documentation consistent
with the implemented integration.

[TESTING.md](../../TESTING.md) defines the checks. Keep proportionate lab
screenshots and static HTML in `visual-acceptance.md`, with the tested revision.
Record Jari's visual verdict when given; unreviewed appearance does not block
functional completion or independent work. The result distinguishes demonstrated
native Taskfleet integration from simulated behavior and remaining gaps.

## Comments

### 2026-10-04T05:45:35Z · @claude

Jari 2026-10-04: issue, ADR 0010 ja decide-taskfleet-browser-integration/design.md on käyty läpi ja hiottu; issue on kunnossa. Taskfleetin tarvitsema muutos on Taskfleet-repon issue caller-owned-agent-runs (aiemmin absolutely-homely-glass), joka on työn alla siellä; repojen välistä riippuvuutta issuectl ei näe, joten toteutus tarkistaa sen tilan ennen aloitusta.
