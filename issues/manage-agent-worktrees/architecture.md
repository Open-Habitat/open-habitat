# Worktree agents that merge themselves: architecture sketch

**Status:** proposal for Jari, written with the prototype round
`design-system/prototypes/rounds/2026-10-16-haaratyo` (issue
[proto-worktree-agents](../proto-worktree-agents/item.md)). Not an accepted ADR.

[ADR 0010](../../docs/decisions/adr-0010-taskfleet-worktree-agents.md) settles who
owns what. Taskfleet owns the run, the node, the worktree and their settlement. The
per-user daemon starts and controls a separate Pi child in the verified checkout.
Pi owns its history. Taskfleet's draft contract
(`taskfleet/issues/caller-owned-agent-runs/{design,writer-fence}.md`) describes a
caller-owned run as `lifecycle: interactive`: it ends only when someone settles it
explicitly. This sketch adds the kind of agent Taskfleet favours, one that finishes
its work and merges on its own. It also says what the browser shows. It moves no
authority between the three components.

## Two settlement policies, one mechanism

A worktree run is created with one of two policies:

- **Merges itself** (`agent`): when the work and its checks are done, the agent
  merges the branch into its source branch. It comes back to the person only if it
  cannot finish.
- **Asks first** (`person`): the agent stops when the work is ready and waits for
  the person's go-ahead.

Both policies settle the same way: the agent runs Taskfleet's own settlement
command in its own execution environment. In "asks first" mode the person gives
the go-ahead by sending a message ("merge into main"). The browser's
*Merge into main* button only sends that message. The browser never calls
`taskfleet run merge` itself. So no settlement call starts in the browser, and the
same path works in the terminal.

The policy is an **instruction, not an authority boundary**. The agent and the
person are the same Unix user, so an agent in "asks first" mode could technically
merge anyway. Taskfleet records the policy on the run (`settlement_policy:
agent | person`). That lets the browser show it and lets a calling agent read it.
Taskfleet adds the policy to the task brief it gives the agent. The host stores no
policy of its own.

## What Taskfleet must provide

The writer fence in Taskfleet's draft already serialises Pi launch against
settlement. A sticky `caller.settlement_intent` closes admission. Git mutation
needs the **exclusive** writer lease, and each host Pi generation holds that lease
**shared** for its whole lifetime. A self-merging agent runs *inside* that Pi.
Today its `run merge` call would record the intent and then fail with
`writer_active`, because its own process holds the shared lease. Self-merging
needs four additions:

1. **Intent completed by the supervisor.** When the agent asks to merge, Taskfleet
   records the merge intent with an operation key derived from the run, node and
   generation. It then returns `intent-recorded` as a normal outcome, not an error
   the agent should retry. Taskfleet's independent supervisor (not the agent, not
   the daemon) completes the recorded intent once the exclusive lease becomes free.
   The completion is the existing Rust merge transaction: rebase, source-OID CAS,
   report `via: explicit-merge`, then Git-only cleanup. No new merge path.
2. **A failed attempt ends the intent.** A sticky intent blocks every later launch.
   If the supervisor's merge fails (a conflict, a dirty target checkout, a moved
   source that cannot be rebased), the intent must end in a durable
   `merge.failed` event with its reason. Work is preserved and the run stays open.
   Otherwise the agent could never be resumed to resolve the conflict. Only
   explicit `cancel` or `discard` may end the run after that.
3. **Identity in the agent's environment.** The daemon starts Pi with the full run
   ID and node ID (for example `TASKFLEET_RUN_ID` and `TASKFLEET_NODE_ID`).
   Taskfleet returns these at creation. The agent never derives them from the
   branch name. `taskfleet run show --current` already resolves the owning run
   from durable node metadata, so it can check them.
4. **The policy on the run** (above), visible in `run show` and `run wait` output.

With these, a calling agent's `taskfleet run wait <run-id>` works without anyone
acting: a self-merging child reaches `done`/merged/landed on its own. An
"asks first" child stays open until the person answers. That is the intended
meaning, and the bounded `--timeout` keeps the caller's own wait honest. Taskfleet
still owns the issue for creation without a terminal worker, supervision outside
the daemon's cgroup, idempotent creation and session binding. This sketch does not
restate those.

## What the daemon does

The daemon runs as the user and invokes Taskfleet's CLI as that user. It gains no
privilege and crosses no user boundary.

- **Create.** On the person's request from a workspace, it calls caller-owned
  `run create` with the workspace's canonical path, its current branch, the task,
  the title, the policy and a stable idempotency key it keeps across retries. It
  starts that command in a per-user transient systemd unit, so Taskfleet's
  supervisor ends up outside the daemon service's `KillMode=mixed` cgroup.
- **Launch.** It reopens the checkout Taskfleet returned, verifies it against the
  exact run, node and checkout, and starts Pi under the gate. Pi gets the shared
  writer-lease FD and the run identity, and Pi's session is reserved and bound.
  This follows `writer-fence.md` step for step.
- **Stop after intent.** When it sees a recorded merge intent for a run whose Pi
  generation it controls, it lets the current turn finish. It then shuts that Pi
  down, reaps it, records `caller.pi.exited` and closes its own lease reference.
  This is the only new daemon duty that self-merging adds. The daemon never
  merges: if it is down, Pi still holds the lease until it exits, and the
  supervisor waits.
- **Observe.** For the workspace page it reads `taskfleet run list/show --json`,
  filtered by exact canonical `source_repo`. It combines that with its own
  knowledge of Pi activity and control. It keeps no copy, cache or registry of
  runs. Taskfleet's state remains the only source.
- **History after cleanup.** It opens a completed run's conversation through the
  durable run/node → Pi session binding, read-only. The checkout no longer exists,
  so continuing is refused with that reason.

**Placement.** The workspace documentation says discovery reads immediate
directories under `~/src` and already recognises linked worktrees there. The
recommendation is that Taskfleet place caller-owned worktrees as immediate
siblings, `~/src/<repo>__wt-<id>-<name>`. The existing `openat2` resolver can then
open them with no nested-path extension. The daemon shows a discovered linked
worktree under its parent workspace when the worktree's path equals the verified
checkout of a run whose source is that workspace. Linked worktrees that match no
run (manual ones, or ones started elsewhere) are shown as today: observed, never
settled from the browser.

## What the browser sees

For each run under a workspace, the prototype assumes these host facts:

| Fact | Source |
|---|---|
| Full run ID, title, branch, checkout path, source branch and OID, policy | Taskfleet run record |
| Run state: open, merge intent recorded, done/merged, failed attempt with reason, cancelled | Taskfleet events and projections |
| Merge outcome: commit, commit count, diff stat, cleanup pending/complete | Taskfleet report and merge transaction |
| Preserved work: branch commits ahead, uncommitted files in the checkout | Git, read by the daemon in the verified checkout |
| Pi activity (working, idle, exited, launch failed) and browser control (controls, lost, terminal) | Daemon |
| Conversation | Pi history via the session binding |

Browser states derived from these facts:

| Browser state | Taskfleet | Daemon / Pi |
|---|---|---|
| Creating (three steps: run, worktree, Pi) | create pending or published | Pi not started yet |
| Working | open, no intent | current generation working |
| Waiting for you | open, no intent | idle and controlled ("asks first", or the agent asked something) |
| Merging | merge intent recorded | Pi shutting down or exited; composer closed |
| Merged | done, merged; cleanup pending or complete | no Pi; history read-only |
| Not merged · work preserved | open; last attempt `merge.failed` with reason | idle, or exited and restartable |
| Agent stopped | open, no intent | no control: daemon restarted or Pi died; *Continue* starts a new generation in the same checkout and session |
| In the terminal · read-only | ordinary Taskfleet-owned run | terminal Pi; the browser does not control it |

Taskfleet run state, Pi activity and browser control stay separate facts. A run
that is open does not mean Pi is working (see the
[integration design](../decide-taskfleet-browser-integration/design.md)).

**Settlement actions in the browser.** Merging goes through the agent, as above.
Cancel, salvage and discard stay in Taskfleet's CLI. The failed state shows the
exact commands to copy. This is the conservative starting point the integration
design recommends: those actions can destroy work or end a run that someone else
is waiting on.

## Security and authority check

- Everything runs as the person's own Unix user: Taskfleet's CLI and supervisor,
  Pi, Git. The gateway only routes to that user's daemon. The provisioning broker
  is not involved.
- No new credentials. Merging is a local Git operation into the user's own source
  checkout, and nothing pushes. Pushing stays a separate action with the person's
  own `gh`/Git credentials, outside this feature.
- No new store. The host derives everything from Taskfleet, Git and Pi on every
  read.
- An attacker who can make the agent merge (prompt injection in the task, for
  example) gains nothing beyond what the agent could already do in that user's
  account. The policy is not a security control, and the UI does not present it
  as one.
- Merging can touch the user's main checkout. Taskfleet's existing cleanliness
  check refuses a dirty target. The browser then shows "not merged" with that
  reason, and the creation dialog warns in advance about uncommitted changes in
  the workspace.

## Open points for Jari

- Confirm that the go-ahead in "asks first" mode is a message to the agent, and
  that the browser gets no merge button that calls Taskfleet directly.
- Confirm sibling placement (`~/src/<repo>__wt-…`) over nested placement plus a
  new resolver.
- Which policy is the default in the creation dialog. The prototype defaults to
  *Merges itself*, following "the agents Taskfleet favours".
