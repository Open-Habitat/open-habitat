# Announce an upgrade to the agents, then start it on time

Revised proposal for Jari's approval, 2026-11-23. **Not an implementation
decision.** Source baseline: `80b0224fe`. It follows Jari's decisions of
23.11.2026 (item.md, Decisions) and the facts in [stop-behaviour.md](stop-behaviour.md).

## In short

The operator starts an upgrade with a lead time, two minutes by default. `host upgrade` publishes the
deadline and begins the stop at that time, even if an agent is still working.
Each person's daemon gives the announcement to the agents of that person's own
conversations: a running turn gets it as a steering message, and an idle agent gets it only when it
has background processes to lose. After the upgrade the daemon wakes every conversation whose
turn the stop cut off and gives it a second message saying what happened and how to
continue. Idle conversations are not woken. Taskfleet workers and other harnesses
get nothing. They run under the user manager and survive the upgrade.

The deadline is **when the stop begins**, not when the new release is ready.

## What the stop does (from the investigation)

- Pi ends. A running turn is cut off and marked as cut by a restart. The
  history up to that point is kept.
- Everything the agent started from its own tools dies: process-tool processes,
  `&`, `nohup`, `setsid` and agent-started `tmux`. `KillMode=mixed` kills the whole daemon
  cgroup however a process detached itself. Process-tool output logs go with it.
- `/tmp` is the daemon's private tmp and is emptied. `/var/tmp`, the home
  directory and workspaces are kept.
- What runs under the person's user manager survives: Taskfleet workers,
  scheduled wakes, the browser's shell tab, SSH, and
  `XDG_RUNTIME_DIR=/run/user/$(id -u) systemd-run --user …`. Without that
  variable `systemd-run --user` fails from Pi, because the daemon does not pass
  it. A user unit sees the host's `/tmp` and `/var/tmp`, not the conversation's.
- After the restart the process tool's list is empty. Survivors are found with
  `ps -u "$USER"`, `systemctl --user list-units` and `taskfleet run list`.
- Today the daemon wakes a cut-off conversation only when it was waiting for a
  background process. A turn cut mid-work stays stopped until the person writes.

## The operator's path and the deadline

This part of the earlier design still holds.

- `open-habitat host upgrade` gains a lead-time input (default **two minutes**) and an
  explicit immediate mode for emergencies. The deadline does not grant
  `--approve-interruption`: the exact-plan, maintenance and interruption approvals stay
  as they are. Exact flag names follow approval.
- The countdown runs in the immutable successor owner, after qualification and
  staging and before `quiesce`. An invocation that only stages announces
  nothing. The host's operation exclusion covers the countdown.
- The deadline is fixed. A turn that finishes early does not bring the stop forward, and
  a new prompt, a long tool or a person typing does not push it back. Only the operator can
  cancel or reschedule, and a reschedule gets a fresh full lead time.
- A caller waits for the command's terminal result, not for idle agents. An operator's
  deployment tooling and the test-server watcher both use this path. Publishing a release is not
  permission to restart an installation.
- Preview validates without announcing. JSON output reports the UTC deadline,
  the schedule identity, how many conversations the announcement reached and the upgrade
  outcome, each separately.

The fences (`publishUpgradeFences`) keep their place at the start of `quiesce`.
They are not published during the countdown, because agents still need their tools then.

## How the deadline reaches each daemon

`host upgrade` (root) writes a small, versioned advisory record that anyone can read,
under the installed product's trusted directory. It holds a random schedule ID,
a revision, the target version, the announcement time, the UTC deadline, the
state (`announced`, `withdrawn`) and an owner-liveness time. It names no account,
conversation, operator text or command. Each daemon watches it (inotify, plus a
bounded periodic reread) and acts only for its own live conversations.

This is the one new architectural element: a read-only signal from host to daemon.
No daemon gains a way to write the schedule, change the deadline,
reach another user or restart anything. Root and the gateway still cannot use the
agent socket. A malformed or untrusted record is ignored. A record whose owner
stopped renewing it reads as withdrawn, never as "restart now".

## Who is told

Only the agents of **daemon-owned conversations**, those a person started in Habitat.
Each one is told once per schedule revision:

| Conversation's state when the record appears | What happens |
| --- | --- |
| Pi up, turn running | The companion steers the announcement into the turn (`pi.sendMessage(…, { deliverAs: 'steer' })`). Pi delivers it after the current tool call returns. |
| Pi up, idle, with live process-tool processes | The announcement starts a short turn (`triggerTurn`). The agent has something to lose: a build or a wait that will be killed. |
| Pi up, idle, nothing running | No message. Nothing of the agent's will be lost and it will not be woken. |
| Pi started by the person during the countdown | Gets the announcement as a steering message in its first turn, with the time left. |
| Pi not running (resting, archived) | Nothing. A conversation is not started just to be told. |

Taskfleet workers, caller-owned agents and other harnesses get no announcement and
no adapter. They live under the user manager and outlive the daemon. While Habitat
is down they only lose its API, which they meet as an ordinary unavailability.

The message is a displayable native custom message (`oh-upgrade-notice`), written
by the companion with the schedule ID and revision, so a reconnect or reread does not
duplicate it. It is neither the person's speech nor an `agent notice`. The
person sees it in the conversation.

## The announcement text

Placeholders are filled by the daemon: `{version}`, `{minutes}`, `{deadline}`
(HH:MM UTC and the person's local time when known).

> [Open Habitat] Habitat will be upgraded to {version}. In about {minutes}
> minutes, at {deadline}, Habitat stops this conversation's Pi, whatever it is
> doing, and starts again a few minutes later. There is no need to answer this
> message. Keep working on the person's task, but get it to a safe point.
>
> What the stop does:
> - Your Pi process ends. If your turn is still running, it is cut off where it
>   is. The conversation up to that point is kept.
> - Every process you started from your own tools ends: process-tool processes,
>   and anything started with `&`, `nohup`, `setsid` or `tmux` from bash. Their
>   process-tool logs are lost.
> - Files under /tmp are deleted. Files under /var/tmp, your home directory and
>   the workspaces are kept.
> - These keep running: Taskfleet workers, scheduled wakes, the person's shell tab
>   and SSH sessions, and commands you start under your user manager with
>   `XDG_RUNTIME_DIR=/run/user/$(id -u) systemd-run --user --unit=<name> <command>`.
>
> Before the stop:
> - Do not start anything long now: builds, test suites, servers, long waits.
> - If something you started is still running, let it finish only if it will
>   finish in time. Otherwise stop it yourself so you know where it stopped. If it
>   really must continue, start it again with `systemd-run --user` as above, with its
>   output in a file under your home directory or workspace. A user unit sees a
>   different /tmp and /var/tmp from yours.
> - Save your work in files. Do not push, merge or call work finished just
>   because of the deadline.
> - If you can reach a natural stopping point in time, end your turn by telling
>   the person where things stand.
>
> After the upgrade: if your turn is still running at the stop, Habitat starts you
> again on its own with a second message about what was cut off. If you have
> finished by then, nothing wakes you, and the person's next message continues the
> conversation.

The idle variant (processes running, no turn) begins with the same first
paragraph and lists, from the companion's inventory, the process-tool processes that
will be killed.

## After the upgrade: who is woken

The new daemon wakes a conversation when its active branch ends in a turn **cut by
the daemon's own stop**: an `oh-restart-stop` mark followed by an aborted or
unfinished turn, which `branchFacts` already recognizes. The wake keeps the bounds
of today's wake machinery (`wake_linux.go`). It is not used for a conversation the
person stopped, an archived one, one with read-only history, or one that is not browser-started.
The 24-hour horizon and the 30-minute cooldown apply, and a full live limit is
retried at the next one-minute check. If the same conversation also had a cut-off wait, it is
woken once, with both facts in one message.

An idle conversation is not woken. Its turn was not cut, and its cut-off waits keep
today's rule.

The wake applies to every graceful daemon stop that cuts a turn, not only to
upgrades. The mark does not tell them apart, and an operator's manual restart cuts
turns the same way. A crash leaves no mark and does not trigger this wake.

The mark is already written by today's companion. A successor that carries the
new wake rule therefore wakes the turns its predecessor cut, starting with the first
upgrade into it.

## The post-restart text

It is a new variant of the companion's catch-up (`catchUpMessage`), whose news is
the cut turn itself. Today's variant needs cut processes or settled runs as news.
`{stopped_at}` and `{version}` are the daemon's own facts (its version after the restart). The process and
spinoff lists are today's.

> [Open Habitat] This conversation's Pi stopped at {stopped_at} when Habitat's
> server restarted (Habitat now runs {version}). The turn you were working on was
> cut off: its last step above never finished. Habitat started you again on its
> own, without a message from the person, so that you can finish it. Habitat
> re-ran nothing.
>
> What the restart did:
> - Every process you had started from your own tools ended, including anything
>   started with `&`, `nohup`, `setsid` or `tmux`. The process tool's list is
>   now empty.
>   {cut-off process-tool processes, as today}
> - Files under /tmp are gone. /var/tmp, your home directory and the workspaces
>   are as you left them.
> - Taskfleet workers, scheduled wakes and `systemd-run --user` units kept
>   running. Find them with `ps -u "$USER"`,
>   `XDG_RUNTIME_DIR=/run/user/$(id -u) systemctl --user list-units` and
>   `taskfleet run list`.
>   {spinoffs whose state changed, and waits to start again, as today}
>
> Before you continue, check what the cut-off step left behind: a command may
> have stopped half-way, and a file may be half-written. Do not repeat a step with
> outside effects (a push, a message, a deploy) before checking whether it
> already happened. Then finish the work, or tell the person what is left. If the
> work was already done, say so in one line and stop.
>
> The person sees this same report in the conversation.

When the person writes to a cut conversation that was not woken (beyond the
horizon, for example), today's catch-up applies unchanged.

## The person's browser

A non-modal installation banner shows the local time and the minutes left. Each
affected live conversation shows the announcement message itself. Drafts are kept
and sending stays possible. When the countdown runs out, the banner says "update
starting", not "complete". During the downtime it shows reconnecting without resending an uncertain
prompt. Cancellation replaces the countdown with "update cancelled", and an owner that
stopped renewing the record shows as unknown status, not as an endless zero. After
the restart the existing restart report (`RestartNotice.tsx`) shows the woken
conversation's catch-up. Shared participants see the banner but no other person's
work. The banner and snapshot fields are new wire, defined in `contracts/v1/`.

## Failure behaviour

| Failure | Outcome |
| --- | --- |
| Qualification, staging or approval fails | Nothing is announced and the predecessor keeps serving. |
| A predecessor without the receiver | It cannot announce. The first upgrade into the receiving release is an explicitly approved ordinary upgrade. The wake on cut turns already works for that upgrade. Announcements start with the next one. |
| A daemon or companion does not answer, the model ignores the message, or a long tool holds the steer past the deadline | Counted as not delivered in the operator's result. The stop happens at the deadline. A missing acknowledgement never becomes a wait. |
| Native history is full or unwritable | The banner still shows the deadline. The message is reported as not persisted. |
| Owner dies before quiesce, the operator cancels, or the target changes | The record is withdrawn and the predecessor keeps serving. A new attempt requalifies and announces a fresh full lead time. An old deadline is never reused. |
| Clock change or late daemon | The record carries absolute UTC time, and the owner counts down monotonically. A late conversation gets the remaining time, not an extension. |
| Failure after quiesce began | The existing fences and the immutable-owner recovery stay authoritative. A cut turn is woken only once the daemon runs again. |
| Many cut conversations at once | They are woken through the live limit, one check a minute, as today's wakes. Up to 64 are scanned per restart (`maxRestartWaits`). |

## What implementation changes

- `internal/cli` and `internal/host`: lead time, the countdown phase, and the advisory
  record (publish, renew, withdraw) with its journal handling on both sides of `quiesce`.
- `internal/daemon`: watch the record, pick recipients from the daemon's own live
  conversations, and the companion operation that writes `oh-upgrade-notice`. Also
  the new wake reason for a restart-cut turn and its `catchUpMessage` variant.
- `contracts/v1/` and `web/`: the banner and the snapshot fields.
- Evidence: deadline enforcement with a busy turn, cancellation and owner loss on both
  sides of `quiesce`, stale revisions, and deduplication across reconnects. A native Pi
  test must show the steer reaching a running model. Distinct-UID tests must show that no user can
  write the record and that root still cannot use `agent.sock`. Also: a wake of a cut turn (and
  no wake for an idle, person-stopped or archived conversation), and the "nothing more to
  do" answer. Then one real predecessor-to-successor upgrade on staging.

## Questions for Jari

1. **Two minutes as the default lead.** Is that the "couple of minutes" you meant?
   It is enough to stop or move a process and save files, but not to finish a
   long step. The operator can choose more.
2. **Wake on any graceful restart that cut a turn, not only on upgrades.** The
   recommendation is yes: the mark is the same, and an operator's manual restart
   leaves the agent just as stranded. The alternative is to tie the wake to the upgrade record, which
   would need the record to outlive the upgrade.
