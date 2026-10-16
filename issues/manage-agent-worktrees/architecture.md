# Spinoff agents in the browser: architecture sketch

**Status:** proposal for Jari, revised on 16 October 2026 with the prototype
round `design-system/prototypes/rounds/2026-10-16-spinoffit` (issue
[proto-spinoff-agents](../proto-spinoff-agents/item.md)). It replaces the
earlier sketch from `proto-worktree-agents`, in which the person created
worktree runs from the browser. Not an accepted ADR.

## The model

Jari, 16 October 2026: a worktree agent is always subordinate to the agent that
started it. An agent starts a worktree for itself with Taskfleet, does one
isolated thing there and merges it when done. The person is not meant to
message the spinoff.

The browser therefore **observes** spinoffs. It does not create them, steer
them or settle them:

- The parent agent, running in an ordinary browser conversation, calls
  `taskfleet run create --kind spinoff` in its own execution environment, just
  as it would over SSH.
- Taskfleet creates the run, the branch and the worktree, launches the
  spinoff's own agent through its normal materializer, supervises it and
  settles it. A self-merging spinoff runs `taskfleet run merge` itself. An
  `--interactive` spinoff waits until its parent runs `run merge` or
  `run cancel`.
- The parent learns outcomes natively, through `taskfleet run wait`, usually
  as a background process that wakes it when the wait ends.
- The browser shows the parent's spinoffs, their state and result, and each
  spinoff's own transcript **read-only**. The person talks only to the parent.

Nothing in this model moves authority between the gateway, the daemon and the
provisioning broker. Everything runs as the person's own Unix user.

## Relationship to ADR 0010

[ADR 0010](../../docs/decisions/adr-0010-taskfleet-worktree-agents.md) made two
decisions:

1. Taskfleet owns the run, node, worktree and settlement. Pi owns its history.
   A branch name never establishes ownership.
2. To let a *person* work with a worktree agent in the browser, the daemon
   starts and controls a separate Pi child in the verified checkout of a
   caller-owned run.

The spinoff model keeps the first decision as it is. It does not use the
second: a spinoff is an ordinary Taskfleet-owned run (`--agent-owner
taskfleet`, the default), and its agent runs where Taskfleet puts it, like any
terminal session. The browser never controls it, which matches "the user is not
meant to message it".

**Recommendation:** once Jari accepts a direction, amend ADR 0010 to say:
spinoffs that agents start are Taskfleet-owned runs that the browser observes
read-only. The daemon-controlled Pi in a caller-owned worktree is deferred until
a person needs to converse with a worktree agent directly. Consequences:

- `manage-agent-worktrees` shrinks to observation: mapping, state and
  read-only transcripts. Creation, the settlement-policy choice, the merge
  button, the writer fence and the launch gate leave this feature's scope.
- Taskfleet's `caller-owned-agent-runs` is no longer a prerequisite for this
  feature. The Taskfleet asks below are smaller and attribution-only.
- The earlier sketch's "merges itself / asks first" policy disappears from the
  UI. Whether a spinoff merges itself or waits for its parent is the parent
  agent's choice (`--interactive`) and is shown as a fact, not offered as a
  control.

## What the daemon needs from Taskfleet

### 1. Which conversation started a run

Taskfleet 0.14 records `created_by_run_id` when `run create` runs inside a
worktree that Taskfleet owns, resolved from durable ownership of the current
directory (`ownership::creator_in_cwd`). A browser conversation's Pi runs in
the workspace's main checkout, which no run owns, so the field is `null` there.
This is exactly the case the browser needs.

**Ask:** an attribution field beside it,
`created_by_session: { harness, session_id }`, taken from an environment
variable that the creating process inherits, for example
`TASKFLEET_CREATOR_SESSION=pi:<session-uuid>`. It is recorded once at creation,
kept on replay like `created_by_run_id`, and shown by `run show` and
`run list --json`.

- **Who sets the variable:** the daemon, when it starts Pi for a browser
  conversation. The daemon already assigns that conversation's fresh Pi session
  ID ([conversations](../../docs/architecture/conversations.md)), so it knows
  the value without any new state. Everything the agent starts (its `bash`
  calls, a `process` running `taskfleet run wait`) inherits it. The agent does
  not need to remember anything.
- **Terminal conversations:** Pi started over SSH has no variable, so its
  spinoffs are unattributed and the browser does not place them. A later Pi
  extension could export the session ID itself so that terminal spinoffs are
  attributed the same way. That is optional.
- **Nested spinoffs:** a spinoff that starts its own spinoff is already
  attributed by `created_by_run_id`. Its worker also inherits
  `TASKFLEET_CREATOR_SESSION` unless Taskfleet clears it for workers. **Ask:**
  Taskfleet removes the variable from a worker's environment, so a nested run
  gets the precise `created_by_run_id` and not a stale session claim. The browser
  shows direct children under a conversation. Grandchildren are reachable
  inside their parent spinoff's view, which this round did not prototype.
- **Trust:** the field is a display association made by the user's own
  processes, as `created_by_run_id` is. It grants nothing. Any process of the
  same user could write a misleading value, and the only effect would be a
  spinoff row under the wrong conversation of that same user. The daemon
  validates the format, uses the value to group rows, and never uses it to
  authorize an action. Other users' runs are unreachable anyway, because
  Taskfleet's state lives in each user's home and the daemon runs as that user.

**Rejected alternatives:**

- Parsing the parent's Pi history for `run create` output. Agent output is not
  a contract, and this is the reconstruction that the Taskfleet
  creator-attribution issue was filed to end.
- A host-side map from run to conversation. That would be a second store of
  the truth.
- Inferring from branch names or the time of creation. Ownership never comes
  from a display fragment (ADR 0010).

### 2. Which session is the spinoff's transcript

The spinoff's agent writes its own native history, but not into Pi's default
session tree. Taskfleet 0.14 starts the worker's Pi with
`--session <state-root>/.creating/pi-sessions/<run-id>/pi-session-<uuid>.jsonl`,
a private file under Taskfleet's state root (`run/spawn.rs`). At the terminal
state it writes `evidence/<node>/pi-session.original.jsonl` (and a resume copy
whose `cwd` is rewritten to the source repository), then deletes the live file
(`supervise/evidence.rs`). So the daemon's discovery under `~/.pi/agent/sessions/`
never sees a spinoff. That is the right outcome, because a spinoff must not also
appear as an ordinary conversation. It also means the transcript has to be
located through Taskfleet.

**Ask:** `run show` / `run list --json` expose, per node, the harness, the
native session ID, the live session path while it exists, and the evidence
transcript path after archiving. Taskfleet already records the live path in the
node's evidence record. The daemon reads whichever copy exists, through its own
read-only resolver anchored at Taskfleet's state root (not `~/.pi`), and checks
the file header before using it: session type, the recorded session ID, and
`cwd` equal to the run's worktree for the live file. It never matches on a path
alone. While the run is live the daemon reads the live file and follows its
growth, as it does for terminal sessions. After the merge it reads the evidence
copy. Both are files of the same user. The read gives no control or
continuation.

This replaces the ADR 0010 need for a "durable run/node-to-Pi-session binding"
for spinoffs: Taskfleet's own evidence archive is the durable copy, and history
after cleanup needs no binding operation.

A spinoff run under the Claude Code profile writes Claude Code's own history.
Reading it in the browser belongs to the harness adapters of
[ADR 0016](../../docs/decisions/adr-0016-native-harnesses-and-subscription-authorization.md).
Until that exists, the spinoff view shows the result and states that the
transcript is not readable in the browser.

### 3. Outcome facts kept after teardown

The browser needs, for every attributed run (including terminal ones): `status`,
`lifecycle`, `attention_required`, `landed`, the merge commit and source branch
and OID, `preserved_work` (branch, worktree path), the failure summary, and
`created_at` and update times. `run show` has these today, except that the merge
commit lives in `report`. **Ask:** terminal runs stay listed with their report
after teardown. Taskfleet's history shows that runs once disappeared from
`run list` after teardown.

What landed (commit count, diffstat, file list) the daemon reads from Git in the
workspace: `git log`/`git diff --stat` between the recorded source OID and the
merge commit. That is a native read on request, not a copy.

## What the daemon does

- **Starts Pi with the attribution variable.** This is the only new launch
  behaviour.
- **Observes.** For a workspace or conversation, it runs `taskfleet run list
  --json` as the user, keeps runs whose `source_repo` is the workspace's
  canonical path and whose `created_by_session` names one of that workspace's
  conversations, and combines them with Git reads and the spinoff's session. It
  keeps no copy, cache or registry. Each read derives the answer again.
- **Opens a spinoff's transcript read-only** through the session identity
  above. There is no composer, continuation or control, and the RPC control
  path is never offered for this session.
- **Hides spinoff worktrees as workspaces.** Taskfleet places worktrees in
  `~/src/<repo>__worktrees/wt-…`, one level below discovery's immediate
  `~/src` children, so they never appear as workspaces of their own. Their
  sessions appear only as spinoffs, under the conversation that started them.
  This sketch drops the earlier recommendation to place worktrees as `~/src`
  siblings: for spinoffs, being *outside* discovery is the right behaviour.

### The parent's waiting state

Jari, 16 October 2026: a parent that has started a spinoff is in practice
waiting for it with a `taskfleet run wait` process. This is its own state,
**Odottaa spinoffia**, distinct from *Odottaa sinua*. The parallel round
`proto-processes-blocks` prototypes process blocks and wake-ups. This round
assumes the following, and the two rounds must agree:

- The state is derived on read: Pi's turn has ended, and the conversation's
  native process list (Pi's processes extension, see
  [extend-process-ui](../extend-process-ui/architecture.md)) has a live process
  that is a recognised Taskfleet wait. No host store is involved.
- The extension records a shell command string, run with `bash -lc`, not argv.
  Recognition is therefore narrow. Only a simple command whose first word is
  `taskfleet`, followed by `run wait` and literal arguments, is recognised: no
  variables, substitutions, pipes or `&&`. The parse belongs in the companion
  extension, which already has a shell parser. It emits a structured field such
  as `taskfleet_wait: { run_ids, mode: all|any }`. The daemon validates each ID
  in Taskfleet's run-ID format and matches it exactly to an attributed run.
  Anything else is an ordinary process. The agent-chosen process name is never
  used.
- `--any` and `--timeout` mean the wait can end without every named spinoff
  finishing. The state names the spinoffs from the parsed IDs, and the wait's
  end wakes the agent either way.
- Only waits in the `process` tool's inventory count. A wait run any other way
  (a background shell job, a terminal) is invisible to this rule, and the
  conversation shows *Odottaa sinua* as before.
- The state names the spinoffs it waits on, with *their* state: the top bar's
  chip and a row at the end of the thread link to the spinoff.
- When the wait process exits, Pi's processes extension delivers the exit to the
  agent. The agent wakes up and starts a turn. The daemon does not write into
  the conversation.
- If the turn has ended with a question and a wait is still running, the
  conversation shows *Odottaa spinoffia*: the host cannot tell that a reply is
  a question. The person can still write.
- A foreground `taskfleet run wait` inside a running turn is plain *Työskentelee*;
  its tool row can use the same special display.

### Process lifetime (host fact that must hold)

A browser conversation's Pi is a child of the daemon service, which runs with
`KillMode=mixed` and `PrivateTmp=yes`. A Taskfleet supervisor and tmux worker
started from inside it would therefore be killed when the daemon restarts, and
their tmux socket under the service's private `/tmp` would be invisible to the
person's own SSH sessions. **Ask (Taskfleet, with Fleetrepo):** Taskfleet
launches the supervisor and worker in their own user unit (`systemd-run --user`)
and places its tmux socket under `$XDG_RUNTIME_DIR`. It must leave the
daemon's cgroup, not just its process group: `setsid`, double-forking or `nohup`
do not survive `KillMode=mixed`. The daemon deliberately starts Pi with a
minimal environment (`PATH`, `USER`, `HOME`), so neither `XDG_RUNTIME_DIR` nor a
session bus address reaches Taskfleet, and `systemd-run --user` then fails even
with lingering enabled (reproduced with that environment on a host with lingering enabled). Taskfleet,
the component that chooses `systemd-run`, owns this precondition: when
`XDG_RUNTIME_DIR` is unset and `/run/user/<uid>` exists and is owned by the
caller, it sets the variable for its own children. The daemon's environment is
not widened for this. The installation fact Fleetrepo must provide is that each
browser user's systemd manager runs (lingering). Until then, the browser can observe
spinoffs that were started from SSH sessions, but a browser parent cannot start
them reliably.

## What the browser shows

| Browser state | Taskfleet facts |
|---|---|
| Työskentelee | run open, worker alive, not `attention_required` |
| Odottaa pääagenttia | `lifecycle: interactive`, worker finished, `attention_required`; waits for the parent's `run merge`/`cancel` |
| Mergetty (with what landed) | `status: done`, `landed: true`, merge commit; diffstat and files from Git |
| Ei mergetty · työ tallessa | `status: failed`, `landed: false`, `preserved_work` with branch and worktree, failure summary |
| Tila ei tiedossa | supervisor dead or stalled, unreadable record. Shown as unknown, not as failed |

Settlement stays with the parent and the CLI. The failed state lists
`taskfleet run show` / `run salvage` commands to copy. The browser has no button
that merges, cancels or discards a spinoff, and none that writes to it. A person
who wants something done about a spinoff says so to the parent.

## Security and authority check

- No new privilege. Taskfleet, its supervisor, the spinoff's agent and Git run
  as the person's Unix user. The gateway only routes to that user's daemon. The
  provisioning broker is not involved.
- No new credentials. Spinoffs merge locally. Pushing remains the person's or
  the parent agent's own act with their own credentials.
- No new store. Attribution lives in Taskfleet's run record, and transcripts in
  native histories.
- `created_by_session` is a same-user display association, not an identity
  claim the daemon trusts (see above). The daemon still never accepts an
  identity claim from the browser or the gateway.
- Read-only means read-only: the daemon offers no control or continuation of a
  spinoff's session, so the browser cannot become a second writer next to
  Taskfleet's worker.

## Open points for Jari

- Accept the ADR 0010 amendment (observe-only spinoffs; caller-owned browser
  worktree agents deferred).
- Accept the Taskfleet asks: `created_by_session` from an inherited variable,
  removal of that variable from worker environments, the node's session
  identity and live and evidence transcript paths in `run show`, retention of
  terminal runs, and supervision outside the daemon's service with its own
  runtime directory.
- Should the daemon tell an idle parent that has no wait running about a
  finished spinoff (by sending a message)? The prototype says no: the parent
  waits natively, and the daemon never authors messages.
