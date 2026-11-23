# What an upgrade's stop does to a person's main agent

Investigation for Jari's 23.11.2026 decision. Source baseline:
`80b0224fe`. The facts in this table feed the announcement and post-restart texts
in [design.md](design.md).

## How it was established

**Code.** The paths are named in each row.

**Experiment (E).** Run on 23.11.2026 on the agent host. The host's own Habitat
services were not touched. A throwaway transient system unit
(`sudo systemd-run --unit=oh-stopexp-…`) ran as an ordinary account with the
process and tmp properties of `systemd/open-habitat-daemon@.service`:
`PrivateTmp=yes`, `KillMode=mixed`, `NoNewPrivileges=yes`, `ProtectSystem=full`,
`OOMPolicy=continue`, and a private directory bound over `/var/tmp`. Its main
process stood in for the daemon. It started a child in its own process group,
as the daemon starts Pi (`pi_rpc_linux.go`, `Setpgid`), with Pi's minimal
environment (`PATH`, `HOME`, `USER`, `SHELL`; no `XDG_RUNTIME_DIR`, see
`continuation_linux.go` before `launchPiRPCSession`). That child ran what an agent's
bash tool might run, and then the unit was stopped with `systemctl stop`, which is the call
`internal/host/upgrade_native_linux.go:quiesce` makes. A fresh instance with the
same binds then looked at what was left. On stop, the stand-in daemon exited
without killing anything, which is the worst case for survival: whatever died,
died because of the unit's stop semantics. The scripts and a trimmed log are in
`/var/tmp/agent-keep/upgrade-announced-to-agents/` (`stop-experiment-2026-11-23.log`).

**Not run.** Nobody upgraded a real installation or restarted a real daemon with a live Pi. The rows about Pi's own
turn and history come from code. The existing native tests cover that code
(`restart_linux_test.go`, `rest_linux_test.go`, `process_resume_native_linux_test.go`).
The transient unit settles the part only the operating system decides: which processes and files
survive the unit's stop.

## The stop, in order

`host upgrade`'s quiesce publishes the upgrade fences, closes entry points, stops the gateway
(browsers disconnect), then runs `systemctl stop open-habitat-daemon@<user>.service`
and the user's listener sockets. User managers are not stopped
(`upgrade_native_linux.go:quiesce`). On SIGTERM the daemon's context ends and
`ConversationController.shutdown` (`conversation_linux.go`) runs. For each live
conversation in turn, it marks the stop as a restart (`rest_linux.go:stopFor`)
and asks the companion to shut down (`pi_rpc_linux.go:close`, at most 5 s). If
the turn is running, the companion writes an `oh-restart-stop` entry into the
native history and SIGKILLs every live process-tool process
(`process-extension.mjs`, `op === 'shutdown'`). The daemon then sends SIGTERM to
Pi, waits 4 s and kills it. When the daemon's main process exits, `KillMode=mixed`
SIGKILLs everything still in the unit's cgroup. After activation, the upgrade starts
the daemon again (`startAcceptedConsumers`). Pi is not started again until a person
writes or a wake starts it.

## Findings

| What | After the stop and restart | How established |
| --- | --- | --- |
| The Pi process | Ends. The daemon sends SIGTERM, waits 4 s, then SIGKILL. Nothing restarts it by itself. | `pi_rpc_linux.go:close`; `conversation_linux.go:shutdown` |
| A running turn | Cut off. Pi saves the reply as aborted. Before that, the companion writes `oh-restart-stop`, so the branch reads as "cut by a restart", not as the person's stop. An idle Pi gets no mark. | `process-extension.mjs` (`restartStopType`, `branchFacts`); `process_interrupted_linux.go` |
| The conversation history | Kept. It is Pi's native session file in the home directory. Everything up to the last saved entry stays. A tool call whose result never came is left unanswered (`turnCut`). | `process-extension.mjs:branchFacts`; `wake_linux.go:cutWaits` |
| Process-tool processes | Killed with SIGKILL by the companion. Their output logs were in the daemon's private `/tmp` (pi-processes `mkdtemp(tmpdir())`), so they are gone too. | `process-extension.mjs` shutdown; pi-processes `process-log-store.ts`; E (private `/tmp` empty after restart) |
| Process tool `list` after restart | Empty. The registry belongs to the Pi that ended. The new Pi's companion finds processes the branch saw start but never saw end and names them in its catch-up: "cut off … no longer running and their output is gone". | `process-extension.mjs` (`branchFacts`, `catchUpMessage`) |
| `cmd &`, `nohup cmd &`, `disown` from bash | Killed. They stay in the daemon unit's cgroup and `KillMode=mixed` kills it. `nohup` only ignores SIGHUP. | E: all were in `system.slice/oh-stopexp-….service` before the stop and gone after |
| `setsid cmd`, detached process groups | Killed for the same reason: a new session or process group does not leave the cgroup. | E |
| `tmux new -d` started by the agent | Killed, server and panes. Its default socket is under the daemon's private `/tmp`, so even its name is gone afterwards. With `TMUX_TMPDIR=/var/tmp` the socket file survives, but the server dies. | E: "error connecting to /tmp/tmux-…/default"; "no server running on /var/tmp/tmux-…/exp2" |
| `systemd-run --user cmd` from Pi as-is | **Fails** with "Failed to connect to bus: No medium found". Pi's environment has no `XDG_RUNTIME_DIR`. | E; `continuation_linux.go` env |
| `XDG_RUNTIME_DIR=/run/user/$(id -u) systemd-run --user …` (a unit or `--scope`) | **Survives.** It runs under the person's user manager, which the upgrade does not stop, and Habitat accounts linger (`internal/provision/linger_linux.go`). | E: `sleep` in `user@…/app.slice/oh-stopexp-u2.service` and `…u3.scope` still running after the restart |
| Taskfleet workers | Survive. Taskfleet starts them under the user manager, as the user unit above. A `taskfleet run wait` started with the process tool is killed like any process-tool process. The catch-up tells the agent which runs still work and how to wait again. | This investigation itself ran as such a worker: `/proc/self/cgroup` is `user@…/app.slice/app-tmux.slice/…`. `process-extension.mjs` (`rearm`) |
| Processes from the browser's shell tab | Survive. The terminal's tmux is started with `systemd-run --user` when the person lingers. | `terminal_linux.go` (`systemd-run`, `lingerDir`) |
| Scheduled wakes | Survive. They are kept in the person's state with a user-manager timer. Overdue ones are processed when the daemon starts. | `scheduled_wake_linux.go` |
| Files in `/tmp` | **Gone.** `/tmp` is the daemon's `PrivateTmp`, removed with the unit. The fresh instance's `/tmp` was empty. | E; daemon unit comment |
| Files in `/var/tmp` | Kept. In a real install, the daemon's `/var/tmp` is `/var/lib/open-habitat-tmp/<user>` on the host. | E (`exp-file`, `nohup.out` present after restart); daemon unit `BindPaths` |
| Paths shared with a user unit | **Not shared.** A `systemd-run --user` unit, a Taskfleet worker and an SSH session see the host's `/tmp` and `/var/tmp`, not the conversation's. A path under `/tmp` or `/var/tmp` passed between them points at different files. The home directory and workspaces are the same everywhere. | E: the user unit's `ls` of both files failed |
| What `ps` shows after restart | The person's own processes on the whole host (`hidepid=invisible` hides other accounts). Survivors are user-manager processes: Taskfleet workers, `systemd-run --user` units, the shell tab, SSH sessions. `systemctl --user list-units` (with `XDG_RUNTIME_DIR` set) lists the units. | `systemd/open-habitat-proc.service`; E (`ps -u`, `systemctl --user list-units` from the fresh instance) |
| What the agent sees when its conversation next runs | The companion's catch-up says Pi "stopped at … when Habitat's server restarted, for example for an upgrade". If the turn was cut, it adds that "the turn it was working on was cut off: its last step above never finished". It lists cut-off process-tool processes and changed spinoff states. When nothing was cut and nothing settled, there is no message. | `process-extension.mjs:catchUpMessage`, `stopFact`, `stopCauses.restart` |
| Is a cut-off conversation woken today? | **Only if it was waiting.** A cut-off process-tool process that would have woken it ("notify on exit") wakes it at once. A `taskfleet run wait` for its own runs wakes it when they settle. A turn cut mid-work without such a wait is **not** woken. Neither is an idle conversation, a person-stopped one, an archived one, one beyond the 24-hour horizon, or one the daemon has not seen as browser-started. A woken conversation also needs news: `catchUpMessage` returns nothing for a wake without cut processes or settled runs. | `wake_linux.go` (`waitOutcome`, `scanRestartWaits`, `peekBrowserOrigin`); `catchUpMessage` |

## What this means for the texts

- Only work running under the user manager survives. For the agent that means
  `XDG_RUNTIME_DIR=/run/user/$(id -u) systemd-run --user`, Taskfleet, the shell tab and SSH. Everything the agent started from its own
  tools dies, however it was detached.
- Anything worth keeping has to be in the home directory or a workspace. `/tmp` is
  lost. `/var/tmp` is kept, but other contexts see it at a different path.
- After the restart the process tool knows nothing. Surviving work is found with
  `ps -u "$USER"`, `systemctl --user list-units` and `taskfleet run list`, and its
  output in a log file the agent chose under its home directory.
- To give "turn was running" conversations their wake, the daemon needs a new wake
  reason. The `oh-restart-stop` mark already exists, so a successor can wake turns
  that its predecessor cut. `catchUpMessage` needs a variant whose news is the cut
  turn itself.
