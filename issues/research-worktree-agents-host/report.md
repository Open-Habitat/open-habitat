# Host architecture for interactive worktree agents

**Status:** research for Jari, 17 October 2026. A recommendation, not an ADR.
Companion to the prototype round [proto-interactive-worktrees](../proto-interactive-worktrees/item.md).

## The question

Jari, 17 October 2026: a person creates an interactive worktree agent from the
browser. They get a new Git worktree of the workspace with its own Pi, talk to
it directly, and see and control its marks and state: branch, ahead/behind,
running/waiting/done, merge and discard.

This is the case ADR 0010 originally decided and ADR 0017 then deferred. Spinoffs,
which an agent starts for itself and the person only watches, stay as they are.
The two things are different and should stay different in the product:

| | Spinoff (ADR 0017, shipped) | Worktree agent (this request) |
|---|---|---|
| Who starts it | The parent agent, `taskfleet run create` | The person, from the browser |
| Who talks to it | Nobody; the person talks to the parent | The person, directly |
| Whose agent process | Taskfleet's worker, in Taskfleet's tmux | Open question (the options below) |
| Who settles it | The agent itself, or its parent | The person |

## What changed since 16 October

Two facts make this round different from the last one.

1. **Taskfleet has shipped most of the caller-owned contract.** The 4 October
   Taskfleet issue `caller-owned-agent-runs` is still open, but the installed
   Taskfleet 0.16.0 (`~/.local/bin/taskfleet`, source tag `v0.16.0`) already has:
   - `run create --agent-owner caller --idempotency-key …`: a Git-only worktree
     with no worker, no tmux and no workmux, keyed replay that returns the
     same run, node and checkout after a lost reply, and an independent
     supervisor in its own `systemd --user` unit
     (`crates/taskfleet/src/run/caller_create.rs`, `docs/LINUX-LIFETIME.md`);
   - `run session reserve | bind | update`: a generation-bound record of which
     Pi session belongs to the run, with `started`, `exited`, `launch-failed`
     and `control-uncertain` facts, kept after teardown
     (`issues/caller-owned-agent-runs/{launch-reservation,session-binding,wait-contract}.md`);
   - a persistent writer fence (`launch-gate.lock`, `writer.lock`) and a sticky
     settlement intent, with fenced `run merge --settlement-key`, `run cancel`,
     `run salvage` and `run discard --force --reason`. Caller-owned merges also
     emit the integrated `merge.rebased` OID that Taskfleet-owned spinoffs lack
     (`writer-fence.md`, `run/merge.rs:40`).

   What Taskfleet explicitly does **not** do is launch Pi. The help text says so:
   the create reply is "NOT Pi launch admission: host-held launch gate and
   inherited writer lease are not integrated yet". That missing half is the
   daemon's.

2. **Taskfleet now has an acknowledged steering channel into its own worker.**
   `taskfleet run message <run-id> <text>` delivers a message through a bundled
   Pi extension (`run/message.rs`, `run/message-extension.ts`) and returns an
   acceptance receipt. ADR 0010 rejected bridging to a Taskfleet-launched worker
   because it "would require a new control protocol between process owners".
   A narrow one now exists. It steers; it does not provide streaming, abort,
   model choice or the rest of the browser's conversation controls.

The second fact is why option C below exists at all.

## The options

All three keep the Unix-user boundary where it is: every process runs as the
person's own user, the gateway only routes, and the provisioning broker is not
involved. They differ in which component owns the worktree's lifecycle and
which process is the agent.

### Option A: Taskfleet caller-owned run, daemon-controlled Pi (ADR 0010 as decided)

Taskfleet creates the run and the worktree, owns settlement and supervises it.
The daemon starts an ordinary browser Pi in the verified checkout and controls
it over RPC, exactly as it does for any browser conversation.

**Creation.** The browser sends a task, a title and a client-generated request
ID. The daemon runs, as the user,
`taskfleet run create --agent-owner caller --kind spinoff --source-repo <workspace> --source-branch <current branch> --title … --task … --idempotency-key <request id> --output json`.
After a lost reply, the browser retries with the same ID and Taskfleet returns
the same run. The daemon keeps no record of its own; the key lives in the
browser's pending command, as message IDs already do.

**Launch.** The daemon opens the returned checkout through its own resolver
(beneath `~/src`, no symlinks), checks it against `run show` and Git's worktree
registry, and then follows the protocol Taskfleet specified in `writer-fence.md`:

1. open `launch-gate.lock` and `writer.lock` from Taskfleet's state root and
   check their recorded device and inode;
2. take the gate exclusively and the writer lease shared;
3. call `run session reserve` with both descriptors, for a fresh Pi session UUID
   that the daemon chose (it already chooses one for every new conversation);
4. start Pi with the writer descriptor added to `ExtraFiles`, next to the
   existing `piOwnership` and workspace descriptors (`internal/daemon/pi_rpc_linux.go:83`);
5. release the gate only after `Start` returns, then `bind` the native session
   file once Pi has written its header and record `update --state started`;
6. on reaping the child, record `update --state exited`.

Pi's conversation is then a normal browser conversation whose `cwd` is the
worktree: streaming, steer, follow-up, abort, model picker, recap, title, held
messages, processes and spinoffs all work unchanged.

**Settlement.** The browser's buttons map one-to-one to Taskfleet commands that
the daemon runs as the user, each with a settlement key the browser generates
and retries with:

| Browser control | Taskfleet command | What happens |
|---|---|---|
| *Yhdistä* (merge into the source branch) | `run merge <id> --node-id n-0001 --settlement-key K` | Intent recorded, daemon stops Pi, Taskfleet takes the exclusive lease, merges, reports, cleans up. A conflict keeps the worktree and intent. |
| *Lopeta, säilytä työ* (cancel, keep work) | `run cancel <id> --settlement-key K --note …` | Run becomes `cancelled`; branch and checkout stay. |
| *Hylkää* (discard) | `run discard <id> --force --reason … --settlement-key K` | Only after cancel or failure; removes worktree and branch with an audit receipt. |
| *Pysäytä* (stop the agent) | the daemon's existing stop | Pi stops. **The run is not settled.** Sending again resumes in the same worktree. |

Taskfleet's reply `writer_active` (intent recorded, Pi still holding the lease)
is not an error for the person: the daemon stops its Pi and retries with the
same key. Taskfleet stays the only component that moves refs or deletes a
worktree.

**Visible over SSH.** `taskfleet run list/show` and `git worktree list` show the
run, branch and checkout. The person can `cd` into the checkout, read the code,
and settle with the same Taskfleet commands. Pi's session file is in
`~/.pi/agent/sessions/` with the worktree as `cwd`, so `pi --resume` lists it.
There is no tmux window. This is exactly how browser conversations already
behave: Pi's RPC cannot be attached from a terminal, so a browser conversation
is readable from the terminal but not shared with it.

**Trade-offs.** Full browser conversation parity and no new agent-control path.
Taskfleet's half is built and tested; the host's half is real work: the
gate-held launch, binding, lifecycle facts, the uncertainty path after a daemon
restart, a history read path keyed by the bound session after teardown, and the
settlement controls. The fence is advisory: a terminal `pi` or editor in the same
checkout is outside it (Taskfleet says so in `writer-fence.md`, "Limit of the claim").

### Option B: the daemon makes the worktree itself, no Taskfleet

The daemon runs `git worktree add ~/src/<repo>--<slug> -b <branch>` and opens an
ordinary browser conversation there. Because the checkout is an immediate `~/src`
child, current discovery already lists it as a linked-worktree workspace
(`docs/architecture/workspaces.md`). This is the prototype's *Paikkana*
direction implemented with the least code.

**Settlement.** Either the person asks the agent to merge (it runs `git` in its
own conversation, as it would over SSH), or the daemon gains its own
merge/discard operations.

**Visible over SSH.** A plain Git worktree in `~/src`. Nothing else to see.

**Trade-offs.** Cheapest to start and closest to "the browser is another way to
reach native tools". But the browser controls Jari asked for (merge, discard,
running/waiting/done) need someone to own the lifecycle. If the daemon owns it,
it becomes a second merge and cleanup engine next to Taskfleet, without its OID
compare-and-swap, crash recovery, writer fence or preserved-work rules. That is
the "parallel store or service" the project avoids. If nobody owns it, merge
and discard are just things the agent might do, the browser can only show Git
facts, and an abandoned worktree has no settled state. Removal also collides with
ADR 0019, which refuses to delete a workspace that is a linked worktree.

### Option C: Taskfleet-owned interactive run, Taskfleet's own worker

`taskfleet run create --interactive` with Taskfleet's normal worker in its tmux.
The browser shows the worker's live transcript, which the spinoff view already
reads safely, and sends the person's messages with `taskfleet run message`.
Settlement is `run merge` / `run cancel` on an interactive run.

**Visible over SSH.** The best of the three: `tmux -S <recorded socket> attach`
puts the person in the very same Pi. One process, one history, typing from
either side.

**Trade-offs.** Not a browser conversation. `run message` delivers steering
text and an acceptance receipt, nothing more. There is no token streaming
(only the session file growing), no abort or stop for a turn, no follow-up
queue, no model or thinking choice, no recap, no held messages and no reliable
working/idle signal. Whether a steering message starts a turn when the worker is
idle depends on Pi's `sendUserMessage` behaviour and is **not verified** here.
Each of these would be a new Taskfleet feature or a parallel protocol, which is
the bridge ADR 0010 chose not to build. It would also make the browser's
conversation view depend on two very different engines.

### Rejected: workmux

Workmux creates a worktree and a tmux window running the agent. The browser could
not control that agent (the same RPC limitation), and Jari decided on
5 October 2026 that caller-owned runs never invoke workmux. It adds nothing that
option C does not already have.

## Recommendation: option A

Option A answers the request as asked: the person talks to the worktree agent in
the browser with all the controls of any other conversation, and the worktree's
state and its end are Taskfleet's, which already owns that lifecycle for every
other worktree on the machine. It also costs the least *new architecture*: the
authority split is the one Jari approved on 4 October, Taskfleet has built its
side, and the host side reuses the daemon's existing launch, ownership lock and
conversation code. The price is SSH parity: the agent cannot be attached from
tmux, the same as every browser conversation today.

Option B is worth keeping in mind only if Jari decides that worktree agents do
not need browser settlement at all, in which case it is honest and small. Option
C is right only if being able to attach the agent in tmux matters more than the
browser conversation controls. Evidence for that would be Jari routinely moving
between the browser and SSH in the same session; this report has none.

**Where the evidence is thin.** No model was consulted for this report; it rests
on the cited sources and on the installed Taskfleet's help output. Taskfleet's
own documents say the gate-held launch, `systemd` cgroup survival with a
daemon-launched creator, and native history retention after teardown have not
been tested end to end with a daemon (`writer-fence.md`, "Verification boundary").
Those are the first things the implementation must prove.

## What the browser can show

Everything below is read again on each request as the user; nothing is stored.

| Mark | Source |
|---|---|
| Title, task | `run show`: title and task |
| Branch | `run show`: `branch` (today `wt/<run-id>`, see the asks) |
| Source branch | `run show`: `source_branch`, `base_sha` |
| Ahead / behind | `git rev-list --left-right --count <source>...<branch>`, read in the source checkout |
| Dirty | `git status --porcelain=v2 -z` in the worktree, through the existing Git pill reader opened at the verified checkout |
| Agent running / working / waiting for you | The daemon's own child state and Pi activity, exactly as for any conversation |
| Agent stopped (resumable) | Pi not running, `caller_agent.state: exited`; the next send resumes |
| Control uncertain | `caller_agent.state: control-uncertain`; shown as unknown, never as stopped |
| Merging / waiting for the agent to stop | `manifest.caller_settlement_intent` present, run not terminal |
| Merged, with what landed | `status: done`, `landed`, the integrated OID from `merge.rebased`; diffstat from Git |
| Cancelled, work kept | `status: cancelled`, branch and checkout from `run show` |
| Not merged, work preserved | `status: failed`, `preserved_work`, failure summary |
| Discarded | discard receipt; conversation remains readable |
| Taskfleet unavailable | executable missing or too old: creation is unavailable, with the reason |

The conversation stays readable after the worktree is gone, through the
session that Taskfleet bound to the run, read with the same confined, header-checked
reads the spinoff view uses. After merge the conversation is read-only, as the
earlier round decided: its `cwd` no longer exists.

## Where it appears

Taskfleet places caller-owned checkouts at `<parent of source>/.taskfleet-worktrees/<run-id>`,
so for a workspace in `~/src` that is `~/src/.taskfleet-worktrees/<run-id>`
(`caller_create.rs:203`). Discovery reads every immediate `~/src` directory,
including dot-directories (`discovery_linux.go:128`), and the current spinoff
exclusion skips caller-owned runs (`spinoffs_linux.go:470`). So today
`.taskfleet-worktrees` would appear as a plain workspace, and the worktree agent's
conversation, whose `cwd` is nested below it, would belong to no workspace.

The recommended placement is to accept Taskfleet's location and make the daemon
place worktree agents by run, not by directory: hide the
`.taskfleet-worktrees` container when caller-owned runs of the user point into
it (as is already done for workmux containers), and show each worktree agent
under its source workspace, found through `run list` by exact `source_repo`.
This settles the earlier round's question 4 without moving checkouts into
discovery's reach, which was the reason spinoff checkouts are kept out too.

## Risks for the Unix-user boundary

- **No new privilege or credential.** Taskfleet, its supervisor, Pi and Git run as
  the person. Merge is local; pushing remains the person's or the agent's own act.
  The gateway and the provisioning broker gain nothing.
- **Paths come from Taskfleet and Git, never from the browser.** The browser sends
  only a full run ID, which the daemon validates by format and looks up in the
  user's own Taskfleet state with its fixed root (the daemon already ignores an
  inherited `TASKFLEET_HOME`). The checkout is opened beneath `~/src` without
  following symlinks and must match `run show`, Git's worktree registry and the
  bound session's `cwd`.
- **The fence is advisory and same-user.** `flock` excludes only cooperating
  writers. The person's own terminal `pi`, editor or a detached tool can still
  write into the checkout. That is the person's own act, not a cross-user risk,
  but the browser must not claim more than Taskfleet does: a merge can still find
  changes it did not expect, and Taskfleet rechecks Git before each mutation.
- **Destructive settlement from the browser.** Discard deletes work. It needs an
  explicit confirmation and reason, is offered only after cancel or failure, and
  goes through the existing gateway write checks and the browser writer lock.
- **Descriptor leakage.** The writer lease is passed into Pi on purpose. Tools Pi
  starts inherit it only if the descriptor is not close-on-exec in them. If a tool
  that writes to the checkout keeps it, merge waits for that tool, which is the
  intended behaviour; one that drops it is outside the fence.
- **Lifetime.** The supervisor runs in the user's own `systemd --user` unit and
  needs lingering, which Fleetrepo already provides for browser users. The daemon's
  minimal environment is enough: Taskfleet derives `XDG_RUNTIME_DIR` itself.
- **Workspace deletion** already refuses while a Taskfleet run of the repository is
  live or its worktree exists (ADR 0019), so a worktree agent's source cannot be
  moved to the Trash under it.

Nothing here lets one user reach another's home, credentials or agents.

## Cross-repository asks for Taskfleet

Most of what ADR 0010 asked for exists. The remaining asks are small:

1. **A way out of a daemon restart.** A daemon restart kills the daemon's Pi
   (`Pdeathsig`), and with it the record of exit is lost. Taskfleet bars a new
   generation after `control-uncertain`. Ask: confirm that a successful
   exclusive probe of the recorded `writer.lock` plus a free native session lock
   is enough for the host to record `exited --reason daemon-restart`, so that the
   next send can resume. Otherwise every product upgrade on the test server
   strands every worktree agent until someone intervenes by hand.
2. **A readable branch name.** Caller-owned branches are `wt/<run-id>`. Ask for an
   optional branch hint (a slug from the title) that Taskfleet still validates and
   makes unique. Display-only, so it does not weaken the rule that a branch never
   establishes ownership.
3. **Released together.** The caller-owned commands are in 0.16.0 source and
   help, but the issue is open. Ask for a release note that names the contract as
   supported, and the version the host can require.
4. **Spinoffs of a worktree agent.** A worktree agent may start its own spinoffs.
   Taskfleet will very likely record `created_by_run_id` for them, because their
   `cwd` is owned by the caller-owned run (`ownership::creator_in_cwd`). The host's
   spinoff filter requires `created_by_run_id == null`
   (`spinoffs_linux.go:149`). This is the host's change, not Taskfleet's, but both
   sides need to agree which attribution wins. Not verified with a real run.

## What ADR 0010 and ADR 0017 would need to change

Jari decides; this is the exact text the decision would touch.

**ADR 0010.** Its decision stands and becomes current again for worktree agents
that a person creates. It would need:

- the status line "Amended by ADR 0017 … caller-owned browser agents are deferred"
  replaced by a pointer to the new decision that reinstates them;
- "Taskfleet needs creation without a terminal worker, recoverable retries and a
  durable run/node-to-Pi-session binding" changed from a need to a fact, citing
  Taskfleet's `run create --agent-owner caller`, `run session` and fenced settlement;
- one added obligation for the daemon: launch only while holding Taskfleet's launch
  gate and with its writer lease inherited by Pi; never launch unfenced;
- the two choices it "leaves to implementation" decided: placement (Taskfleet's
  `.taskfleet-worktrees`, placed in the browser by run) and browser settlement
  (merge, cancel with work kept, discard after cancel, through Taskfleet's keyed
  commands).

**ADR 0017.** Its spinoff decision is unchanged. It would need:

- the sentence "browser-controlled worktree agents using caller-owned runs are
  deferred until direct conversation with a worktree agent is needed" replaced by:
  the person-created worktree agent is now needed (Jari, 17 October 2026) and
  follows ADR 0010; agent-created spinoffs remain observe-only;
- a line that the two are distinct: a spinoff is `agent_owner: taskfleet` and never
  controllable in the browser; a worktree agent is `agent_owner: caller` and is a
  browser conversation. The daemon must never offer control of the former.

If Jari prefers option C instead, ADR 0010's reason against a bridge ("would require
a new control protocol between process owners") would need rewriting around
`taskfleet run message`, and ADR 0017's "the person is not meant to message the
spinoff" would need an exception for interactive runs. If option B, ADR 0010 would
be replaced rather than amended, because Taskfleet would no longer own these
worktrees.

## Questions for Jari

1. Option A, B or C? The recommendation is A.
2. Which settlement controls belong in the browser: merge, cancel with work kept,
   discard? Or only merge, with the rest left to the agent and the CLI as before?
3. Is it acceptable that a browser-created worktree agent cannot be attached from
   tmux, as with any browser conversation?

## Sources

- This repository: [proto-interactive-worktrees](../proto-interactive-worktrees/item.md),
  [proto-worktree-agents](../proto-worktree-agents/result.md),
  [manage-agent-worktrees architecture](../manage-agent-worktrees/architecture.md),
  [implement-spinoff-agents result](../implement-spinoff-agents/result.md),
  [decide-taskfleet-browser-integration design](../decide-taskfleet-browser-integration/design.md),
  [ADR 0010](../../docs/decisions/adr-0010-taskfleet-worktree-agents.md),
  [ADR 0017](../../docs/decisions/adr-0017-observe-taskfleet-spinoffs.md),
  [ADR 0019](../../docs/decisions/adr-0019-workspace-deletion.md),
  [conversations](../../docs/architecture/conversations.md),
  [workspaces](../../docs/architecture/workspaces.md), `internal/AGENTS.md`,
  `internal/daemon/{pi_rpc,discovery,spinoffs}_linux.go`.
- Taskfleet (`~/Sources/taskfleet`, tag `v0.16.0`):
  `issues/caller-owned-agent-runs/{item,design,plan,launch-reservation,session-binding,wait-contract,writer-fence}.md`,
  `docs/LINUX-LIFETIME.md`,
  `crates/taskfleet/src/run/{caller_create,message,merge,ownership}.rs`,
  `crates/taskfleet/src/run/message-extension.ts`, and the installed CLI's
  `run create`, `run session`, `run merge`, `run discard` and `run message` help.
