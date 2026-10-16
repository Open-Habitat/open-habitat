# Agent processes in the browser: architecture sketch

A proposal for Jari, not an accepted ADR. It says how the host would serve the
prototype rounds `design-system/prototypes/rounds/2026-10-16-prosessit/`
(issue `proto-processes`; Jari chose direction 3, *Kentän yllä*) and
`rounds/2026-10-16-prosessilohkot/` (issue `proto-processes-blocks`: the
process blocks in the thread, completion wake-ups and the waiting states), and starts from the extension evidence in
[native-processes.md](native-processes.md). Where that note and this one
overlap, the evidence note owns the facts about `@aliou/pi-processes`
0.10.9; this one decides what the host does with them.

## Who owns what

The pi-processes extension inside the conversation's Pi owns the processes:
it starts them, keeps their registry in memory, writes their logs in its own
temporary directory and stops them. Nothing about that changes. The daemon,
running as the mapped Unix user, relays the extension's inventory, output and
stop command for the Pi children it started itself. It keeps no process list,
no log copy and no PID table of its own, and it never signals a process
directly: the extension is the only component that knows which process group
belongs to which record, and a daemon-side PID would be a second, staler
answer to the same question.

The gateway only authenticates and forwards, as for every other conversation
command. No component outside the user's own daemon and Pi sees the
processes, so the Unix-user boundary is unchanged: the daemon reaches only its
own children, through a channel inside its own service.

## The bridge from daemon to extension

The extension's inventory, output and kill live on Pi's in-process event bus
(`processes:request:list`, `processes:request:combined_output`,
`processes:logs:subscribe`, `processes:command:kill`). Pi's RPC protocol cannot
reach that bus, and the `/ps` commands degrade to plain text in RPC mode.
Something must sit inside the same Pi.

**Recommendation: a small companion extension that the daemon loads into the
Pi children it starts, talking to the daemon over a private socket.** The
daemon already launches Pi itself; `pi --extension <path>` loads an extra
extension without touching the user's settings. The companion:

- checks at load that pi-processes is present and answers on its channels,
  and reports its version, so the daemon can tell "extension missing" from
  "no processes";
- serves four operations: list, combined-output tail, output subscription and
  kill, each mapped one to one onto the extension's own channel;
- listens on a Unix socket whose path the daemon passes in the environment.
  The path lies in a fresh 0700 directory inside the daemon service's private
  `/tmp` (the unit has `PrivateTmp=yes`, and Pi shares that namespace as the
  daemon's child), so no other service or user can see it. The daemon checks
  `SO_PEERCRED` on connect: same UID and the PID of its own Pi child.

The companion is product code shipped in the release, not something the user
installs. It holds no state beyond open subscriptions.

Two alternatives were weighed. Invoking a private companion command through
RPC `prompt` and reading its reply from an `extension_ui_request` notification
needs no socket, but it rides on a path built for display text, carries no
correlation or structure and risks interfering with an active agent turn; it
is fine for a first spike, not for production. A generic "call extension
channel" RPC command upstream in Pi would remove the companion entirely and is
the better long-term answer; it is worth proposing upstream, but the host
should not wait for it.

## What crosses to the browser

Proposed additions to `contracts/v1/`; nothing is edited yet.

`GET /api/v1/conversations/{id}/processes`

```json
{ "schema_version": 1, "owner_generation": "og_…",
  "availability": "available",
  "unavailable_reason": null,
  "processes": [
    { "id": "proc_8c2e", "name": "testit", "command_preview": "ptw tests/ -- -q",
      "process_token": "pt_…", "status": "running", "started_at": "…", "ended_at": null,
      "exit_code": null, "signal": null, "end_reason": null } ] }
```

`availability` is `available` or `unavailable`; the reason is one of
`pi_not_running`, `terminal_control`, `extension_missing`,
`bridge_unavailable` or `error`. An unavailable inventory is never sent as an
empty list, because the browser shows them differently (prototype scenarios
"Ei prosesseja" against the other four). `status` is the extension's own
vocabulary: `running`, `terminating`, `terminate_timeout`, `exited`, `killed`.

`GET /api/v1/conversations/{id}/processes/{process_id}/output?tail_lines=N`
returns `{ owner_generation, lines: [{stream: "stdout"|"stderr", text}],
omitted_before, retention_restarted }`. N is bounded (2000); `omitted_before`
is the count of earlier lines when known, otherwise null.
`retention_restarted` is true, false or null: the extension truncates a log
file to zero at 64 MiB, and only the marker in the file proves that it
happened.

`POST /api/v1/conversations/{id}/processes/{process_id}/stop` with
`{ owner_generation, process_token, force }` sends the extension's kill: SIGTERM to the
process group with its three-second timeout, or SIGKILL when `force`. The
reply is the extension's result (`killed`, `terminate_timeout`, `not_found`,
`error`). It goes through the same CSRF and command path as the other
conversation commands.

Two new SSE event kinds carry live change on the existing user stream:
`process.changed` (a record started, ended or changed status; the browser
refetches the inventory) and `process.output` (bounded lines for one process,
with a per-process sequence and the extension's dropped-line count). A gap in
the sequence, a dropped-line count or a reconnect makes the browser refetch
the tail instead of claiming a complete log. The subscription runs only while
a browser view of that process is open.

`owner_generation` names one Pi child of the daemon, but it is not enough on
its own: a process ID is four hex digits checked only against the records the
manager still holds, and the manager reaps finished records during its life,
so the same ID can be issued again inside one Pi child. Every process-specific
read and the stop therefore carry both `owner_generation` and a
`process_token` derived from the record's start time. The companion compares
the token with the live record immediately before it calls the extension, and
a mismatch, like a stale generation, answers 409 and the browser refetches.

The daemon never sends PIDs, log paths, the absolute working directory or the
raw command. `command_preview` is a redacted hint, not a faithful copy. Before
it leaves the daemon, the value of every leading environment assignment, URL
user-info, header arguments (`-H`, `--header`) and the value of any long option,
`--name=value` or `--name value`, whose name contains token,
secret, key, pass, auth, user or cred become `•••`, as do strings with a known
credential prefix (`ghp_`, `github_pat_`, `sk-`, `xox`). This is a deny-list
and cannot catch every tool's credential syntax; the contract says so, and the
full command is never sent, so a missed case shows in the preview only.
Output lines are the user's own process output and are passed as is,
bounded in size; this is the same exposure the user has in the terminal.

## Lifecycle

| Event | Processes | What the browser shows |
| --- | --- | --- |
| Browser closed or disconnected | keep running | nothing changes; on return the inventory is fetched again |
| Agent turn ends, conversation idle | keep running | inventory unchanged |
| User stops one | extension kills its group | `Pysäytetään…`, then `Pysäytetty` or `Ei pysähtynyt` with *Pakota lopetus* |
| Pi closed by the daemon | must be stopped by the extension first (see below) | `Pi ei ole käynnissä` |
| Daemon restart or upgrade | systemd stops the whole service cgroup (`KillMode=mixed`), private `/tmp` and the logs go with it | `Pi ei ole käynnissä`; continuing starts Pi with an empty manager |
| Pi crashes | detached process groups may keep running inside the service cgroup without a manager; nobody can list them | `Pi ei ole käynnissä`; the host does not claim they stopped |
| Terminal-controlled conversation | owned by the terminal Pi, out of reach | `Ohjataan terminaalista`, never an empty list |
| A process ends while the agent works | the extension steers the agent | a `process_event` block (`steer`) inside the turn |
| A process that can wake the agent ends after the turn | the extension starts a run | the block (`wake`) opens a new turn; *Odottaa prosessia* becomes *Työskentelee* |
| A process set to `context` ends after the turn | appended without a run | the block (`context`) in history; the state does not change |
| A recognised `taskfleet run wait` ends | as any process | the block shows the spinoff's result; *Odottaa spinoffia* becomes *Työskentelee* |
| The user clears finished processes | extension removes records and logs | history keeps the blocks; output says it was removed |

A user's stop is intentional in the extension's sense: it suppresses the exit
notification, so the agent is not told. The prototype says this in the stop
tooltip and the toast; whether the host should instead tell the agent is a
question for Jari.

**Required change found while sketching.** `piRPC.close()`
(`internal/daemon/pi_rpc_linux.go`) gives Pi 100 ms after SIGTERM before
SIGKILL. That is too short for the extension's `session_shutdown` cleanup,
and the extension runs its commands in detached process groups, so killing Pi
leaves them running as orphans in the daemon's cgroup until the next daemon
stop. Today this is latent: the only closing path wired to the browser closes
an empty conversation, which cannot have processes. Before processes become
visible, closing a Pi that has live processes must first ask the companion to
stop them (or wait for Pi's graceful shutdown with a bounded timeout) and only
then close the RPC child. This is part of the implementation issue, not a
separate fix today.

A sturdier answer to the crash row is to run each Pi child in its own cgroup
(a transient systemd scope) so the daemon can stop its whole tree when Pi
dies. It needs systemd delegation for the daemon unit, which is an
installation change in Fleetrepo, so it is recorded here as an option rather
than proposed.

## Completion: how the agent learns, and how the daemon learns

What the extension does natively (0.10.9, `extensions/processes/`):

- The `process` start call normalises a `notify` setting per process:
  `onSuccess`, `onFailure` and `onKilled`, each `turn`, `context` or
  `ignore`, plus optional log watches with their own level. The defaults are
  `turn` for success and failure and `context` for an external kill
  (`tools/notify.ts`). The start tool result's `details` carry the record and
  the normalised `notify`; a later `update` call changes only log watches.
- When a process ends by itself, the notification service turns the end into
  `pi.sendMessage` with `customType: "ad-process:notification"`,
  `display: true`, a `details` object (kind `success`, `failure`, `crash`,
  `killed` or `log_match`; process ID and name, raw command, exit code, end
  reason, signal, attention) and the options `deliverAs: "steer"`,
  `triggerTurn: attention == "turn"` (`notification-sender.ts`). A failure
  set to `ignore` is still delivered as `context`. An intentional stop, the
  tool's or `/ps:kill`, is classified first and sends nothing; the
  companion's stop uses the same kill command and is therefore silent too.
- Pi persists the message in the session as a displayed custom message. If
  the agent is running, it arrives as steering after the current tool calls.
  If the agent is idle and the attention is `turn`, Pi starts a run with the
  message as its trigger: the agent wakes. With `context` it is appended
  without a run and reaches the model on the next turn.

The daemon needs no new source for this. The Pi RPC stream already carries
the custom message's `message_start`/`message_end` and the run's
`agent_start`/`agent_end`, and the session history already contains the
message; today both are projected as an anonymous "Extension message". The
proposal is to recognise `customType == "ad-process:notification"` in the
live projection and the history projection alike and emit a typed block:

```json
{ "type": "process_event", "kind": "success", "process_id": "proc_9d4b",
  "process_name": "hidas-testi", "command_preview": "python3 -m pytest …",
  "exit_code": 0, "signal": null, "end_reason": null,
  "delivery": "wake", "spinoff": null }
```

The block is built from `details` only, never from the XML `content`, which
repeats the raw command. `command` gets the same redaction as the inventory's
`command_preview`. `delivery` is `steer` when the message arrived inside an
active run, `wake` when no run was active and Pi's next `agent_start` belongs
to it, and `context` otherwise. Live, the daemon knows from its own run state;
in history, the entry before the message decides: an assistant message that
ended its turn (`stopReason` `stop`) followed by a new assistant message is a
wake, a tool result or an assistant message that called tools is a steer.
Nothing is stored: the block exists because the native session has the
message, and the browser never shows a completion that Pi did not deliver.

**Required change found while sketching.** A wake-up run is started by Pi, not
by a browser command. The daemon's per-conversation command state
(`internal/daemon/conversation_linux.go`) moves to `accepted` only when the
browser's send is accepted, and `agentPresentation` treats only an accepted
command as proof of work. A wake would therefore show *Odottaa sinua* while
Pi works, and a send in that window would be sent as a fresh prompt into a
streaming Pi. Pi's own `agent_start` must count as proof of an active run
(`working`), with the composer offering steering and Stop exactly as for a
browser-started turn, and `agent_end` returning to idle. This is the one
change outside the process code that the wake-ups need.

## Waiting for processes and spinoffs: derived, not stored

When the run has ended and a running process whose end will start a run
exists, the agent is waiting for its processes, not for the user. The daemon
derives this on each snapshot and on `process.changed` from two native facts
it already has, and keeps nothing:

1. its own run state for the Pi child (from `agent_start`/`agent_end`, as
   above), and
2. the companion's live inventory, where each running record gets
   `wakes_agent`: true when the process's normalised `notify` has `turn` for
   success, failure or any log watch.

`wakes_agent` comes from the start tool result's `details.notify` in the
native session, joined by process ID and start time (the `process_token`)
among the entries written after the current Pi child started, and adjusted by
later `update` results for log watches. If the join finds nothing, the value
is `null` and the process does not count: the host does not claim the agent
waits for something it cannot show. The cleaner long-term source is the
extension itself; asking upstream to include `notify` in the
`processes:request:list` reply would remove the join.

The snapshot gains `waiting_on`, a list of `{ process_id, name, kind }` with
`kind` `process` or `taskfleet_wait` (then also `run_ids`), and the
presentation gains two activities, ordered after *Työskentelee*:

| Facts | Activity | Label |
| --- | --- | --- |
| run active (browser- or Pi-started) | `working` | Työskentelee |
| no run, pending question | `waiting` | Odottaa sinua |
| no run, inventory available, a `wakes_agent` record is a recognised `taskfleet run wait` whose runs are not all terminal | `waiting_spinoff` | Odottaa spinoffia |
| no run, inventory available, another `wakes_agent` record runs | `waiting_process` | Odottaa prosessia |
| no run, otherwise (including processes that cannot wake the agent, such as a server started with `context`) | `waiting` | Odottaa sinua |
| no inventory (terminal control, Pi stopped, extension missing) | unchanged from today | the host does not claim either waiting state |

A pending question to the user wins, because the agent cannot continue
without the user even if a process later wakes it. The derivation needs no
persistence: after a daemon restart the processes are gone with the service,
and with them the reason to wait.

## Recognising `taskfleet run wait`

The browser never sees the raw command, so the daemon recognises the waiting
process. It accepts only a command that is, after whitespace splitting and
with no shell metacharacters (`| & ; < > ( ) $ ` \ " '` or a newline) at all:
`taskfleet` or an absolute path whose basename is `taskfleet`, then `run`,
`wait`, options only from the documented set (`--all`, `--any`,
`--timeout V`, `--fail-on-error`, `--progress`, `--poll-interval V`,
`--output V`, `--json`), and one or more run IDs in Taskfleet's ID grammar.
Anything else, including an environment prefix or a pipe, stays a generic
process. Recognition only changes presentation: the stop still goes through
the extension's kill and stops the waiting, not the spinoff.

For a recognised wait, the spinoff's title, state and result come from
Taskfleet through the mapping in
[../manage-agent-worktrees/architecture.md](../manage-agent-worktrees/architecture.md)
(`taskfleet run show <id> --output json`, run as the mapped user with a fixed
argv and the validated ID). The daemon reads only the user's own Taskfleet
state, so the Unix-user boundary is unchanged. When the wait ends, its
notification is an ordinary `process_event`; the daemon fills `spinoff`
(`run_id`, `status`, `landed`, `commit`) from the run's terminal record at
projection time. A terminal record no longer changes; if it has been pruned,
the block is shown as the generic process it is.

## Clearing finished processes

Jari wants *Poista päättyneet* in the tray. The companion maps it onto the
extension's `processes:command:clear`, which removes the finished records and
their log files:
`POST /api/v1/conversations/{id}/processes/clear-finished` with
`{ owner_generation }`, through the same CSRF and command path. The session
history keeps the start calls and notifications; their output link then says
the output was removed. The prototype asks for no confirmation, because the
records are reaped automatically anyway and only logs of ended processes are
lost; the tooltip says so.

## Not in this slice

Processes of terminal-origin Pi (needs a native interface from the terminal
owner; `/proc` scanning and temp-directory enumeration are ruled out),
writing to a process's stdin, log search, pinning, the dock, and showing or
editing notification watches. A foreground `taskfleet run wait` run with
`bash` inside a turn is just a long tool call; the thread shows it as a
`bash` row while the agent is *Työskentelee*.

## Verification before implementation

The evidence note lists what must be proved in a real RPC child: that the
companion loads beside pi-processes, the shape of each reply, that a list
during an active agent turn does not disturb it, subscription handoff under
concurrent output and process end, and the missing-extension and Pi-exit
failure modes. To that list this sketch adds: Pi's behaviour on stdin close
versus SIGTERM (does `session_shutdown` run, and how long it needs), and that
the companion socket is unreachable from another user's daemon. The wake-ups
add: that in RPC mode an idle `sendMessage` with `triggerTurn` emits the
custom message and then `agent_start` in that order; how steering delivery
shows in the stream and in the session (which entry precedes the message);
and that the start tool result's `details.notify` is present in the session
for the join.
