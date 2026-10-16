# Result

After a daemon restart, a background process the agent had started no longer
vanishes. The conversation's process tray shows it under **Katkenneet**, labelled
*Katkesi palvelimen uudelleenkäynnistyksessä* (or *Katkesi, kun Pi pysähtyi*
for a Pi that stopped while this daemon kept running), even while Pi is not
running. When the person next sends, the agent's turn carries one context
message naming the processes that were cut off; from then on the transcript
holds that trace and the tray row is gone. The agent-side message is shared
with [spinoff-catch-up-on-resume](../spinoff-catch-up-on-resume/result.md),
which adds the spinoff part; both are recorded in
[ADR 0021](../../docs/decisions/adr-0021-resume-catch-up.md).

## Why the process vanished

A daemon stop (`KillMode=mixed`) lets the daemon close every Pi; `close` asks
the companion to `shutdown`, which kills each live process through
pi-processes' `command:kill`. pi-processes treats that as an intentional stop
and sends no notification, so nothing in the branch records the end, and the
new Pi's registry starts empty. Established from the code
(`pi_rpc_linux.go` `close`, `process-extension.mjs` `shutdown`,
pi-processes `notifications/service.ts` `consumeIntentionalStop`) and
reproduced by the host-backed test below; the test server's logs were not
needed and were not read.

## How

The evidence is the native branch, not a new store. A `process` tool result
with `action: start` that the active branch never follows with an
`ad-process:notification` end (success, failure, crash, killed) or a `stop`
result has not been seen to end. If it started before the current Pi launched
(or Pi is not running), it is certainly gone: Pi's processes end with it.

- **Daemon** (`internal/daemon/process_interrupted_linux.go`): scans the
  active leaf's ancestry, keyed by the session file's stat stamp
  (`snapshot_facts_linux.go`) so the tray's two-second poll re-reads only after
  Pi wrote. The inventory gains `interrupted` (contract
  `contracts/v1/process.schema.json`), present also when Pi is not running;
  the reason is `server_restart` when the process started before this daemon
  did, else `pi_stopped`. Only browser-origin conversations get it: a terminal
  Pi may still own its processes.
- **Companion** (`process-extension.mjs`): the same rule over
  `sessionManager.getBranch()`; on the first run after Pi starts it lists the
  unreported cut-off processes in its context message and records them in the
  message details, which both sides read to avoid repeating themselves.
- **Browser** (`ProcessTray.tsx`): a static *Katkenneet* group without
  output or controls, with a line saying the agent will hear about them with
  the next message. A cut-off spinoff wait stays out of the tray, like a live
  one (its spinoff group shows the run).

## Evidence

Synthetic, same UID; not live-host or distinct-UID evidence.

- `TestProcessResumeCatchUpAcrossDaemonRestart` (Go, real pinned Pi 1.3.0,
  real pi-processes 0.10.9, the shipped companion, two real controller
  incarnations): after the first controller's stop the second reports both
  cut-off processes as `server_restart` with the wait's run ID; the resumed
  turn's provider request contains the message naming the process; after that
  turn the tray list is empty; a third incarnation with nothing new adds no
  message. Removing the companion's message makes it fail.
- `process-tray.spec.ts` "@process-tray a process cut off by a daemon
  restart shows as ended by the restart" (real gateway, controller and fake
  Pi, `/fixture/daemon-restart`, no mocked process route): the tray reads the
  cut-off process from the branch, labelled by the restart, with no controls;
  axe clean.
- `TestProcessInterruptedFromActiveBranch`: abandoned branches ignored,
  reported processes hidden, reason by daemon start, command preview redacted.
- `catch-up.test.mjs`: end notifications, stops, reused IDs, silent-success
  starts and earlier reports.
- `ProcessTray.test.tsx`: the tray while Pi is stopped, no controls, no
  cut-off wait.

Screenshots from the synthetic lab after a real fake-Pi turn and
`/fixture/daemon-restart` (`capture.mjs`): `desktop-light-interrupted.png`,
`desktop-dark-interrupted.png`, `phone-light-interrupted.png`,
`phone-dark-interrupted.png`.

## Decisions for later review

1. **A process stopped from the browser tray looks cut off after a restart.**
   A browser stop is also an intentional pi-processes stop and leaves no
   record. While the same Pi runs it shows correctly as stopped; after a
   restart it appears under *Katkenneet* and the agent is told it was cut off.
   Recording browser stops would need a write into the conversation; not done.
2. **A process started with `notify.onSuccess: "ignore"` is never reported**:
   its successful end leaves no record, so its absence proves nothing.
3. **The tray shows a cut-off process only until the agent has been told.**
   After the next send the transcript's extension message is the trace;
   *Poista päättyneet* could not clear branch-derived rows anyway.
4. **The message is visible in the transcript** (`display: true`), in English
   because it is addressed to the agent, as an extension message card.

## Should processes survive daemon restarts? Recommendation for Jari

Recommend **no, keep processes session-scoped**, and revisit only if real use
shows long work regularly lost.

- *For surviving (own user units, as Taskfleet does):* long builds and dev
  servers would outlive releases, which on the test server happen on every
  `main` commit.
- *Against:* pi-processes owns the registry, logs, signals and wake-ups and
  ends them with the session on purpose (Fleetrepo ADR 0011 calls that a
  safety property). Surviving processes need a second runtime outside Pi with
  its own registry and logs, the very duplicate this project avoids; a process
  that exits while Pi is down still wakes no one, so the catch-up would be
  needed anyway; forgotten servers would accumulate per user; and the browser
  would have to reconcile processes no Pi owns.
- *If revisited:* an explicit opt-in for one process (for example a durable
  flag that starts it as a `systemd-run --user` unit with its own log), read
  back the way spinoffs are, rather than making every process durable.
