# Result

When a parent conversation's Pi starts again after a daemon restart (the
person's send, ADR 0020), Open Habitat's companion Pi extension adds one
non-triggering context message to that first run. It names the
conversation's spinoffs that settled while Pi was down and how (merged,
finished but not merged, failed, cancelled, waiting for attention, stalled),
the processes that were cut off
([processes-lost-on-restart-silent](../processes-lost-on-restart-silent/result.md)),
and the spinoffs still running whose wait was cut off, with the literal
`taskfleet run wait <ids> --output json` to start again with the `process`
tool. Nothing settled and nothing cut off means no message. Jari's decision is
recorded as [ADR 0021](../../docs/decisions/adr-0021-resume-catch-up.md),
linked from ADR 0017.

## How

`internal/daemon/process-extension.mjs`, inside the user's own Pi, as that
user:

- On `session_start` it reads the branch (`sessionManager.getBranch()`) and
  starts reading Taskfleet: `taskfleet run list --repo <cwd>`, filtered to
  runs whose `created_by_session` is this Pi session in this checkout (the
  daemon's `belongsSpinoff` rule), then `run show` for each settled one,
  which carries the landed flag and `manifest.updated_at`.
- Runs created from a subdirectory of the checkout count, compared by git
  toplevel like the daemon does.
- A run the agent was waiting for (a cut-off wait that would have woken it)
  is always read: settled in any way it is news; still running, its wait is
  to be restored (conductor's decision: re-arming only restores what the
  agent asked for). Any other run is news when its record changed to a
  settled state after the branch's last entry; a stall counts without that
  time check, since Taskfleet computes it when read and never advances the
  record. Earlier catch-ups' run and state are not repeated. At most the 20
  newest other settled runs are read.
- On the first `before_agent_start` it returns the message, waiting at most
  3 s for Taskfleet; if Taskfleet is slow, missing or older, the spinoff part
  is left out and the process part still goes. A Pi started only to rename a
  session runs no turn, so it adds nothing.
- The message details (`oh-resume-catch-up`: processes, spinoffs, rearm) are
  the only record of what was said; both the companion and the daemon's tray
  read them back from the branch.

## Evidence

Synthetic, same UID; not live-host or distinct-UID evidence.

- `TestProcessResumeCatchUpAcrossDaemonRestart` (Go; real pinned Pi 1.3.0,
  pi-processes 0.10.9, the shipped companion, a Taskfleet stand-in reading
  records from the synthetic home, and two then three real controller
  incarnations). The parent starts a server and a wait for spinoff A; the
  daemon stops; spinoff B finishes. On the resumed send the provider request
  contains the message: the cut-off server, B "finished and merged", and the
  wait command for A. The scripted agent starts that wait; when A finishes,
  pi-processes wakes the parent with a new turn whose request contains A's
  wait result. A further restart with nothing new adds no second message.
  The test fails when the companion's message is removed.
- `catch-up.test.mjs` (node): other sessions' runs ignored, runs settled
  before the last entry ignored, an already reported run and state not
  repeated, only a waited-for running run restored, missing Taskfleet tells
  nothing, a restored wait alone is no message, one message per Pi.

## Review

Independent `/llm-review` (finder GPT-6 Astra, verifier Claude Fable 5.1, two
calls; routine rigor because the diff touches daemon state, the contract and
what enters an agent's context). Five findings, all confirmed and fixed:
spinoffs created from a subdirectory were missed; a newest-twenty cap could
hide a waited-for run; stalls were gated on a timestamp they never advance;
browser origin was taken as proof that no Pi runs (now a writer census, tested
with a terminal-like writer); a failed stop counted as an end (both rule
copies, tested).

## Decisions for later review

1. **The agent restores the wait, not the companion.** Pi 1.3 gives an
   extension no way to start a pi-processes process outside a tool call
   (`executeTool` exists only inside a tool's `execute`), and pi-processes'
   bus has no start command. A companion-owned waiter would be a second
   background runtime that Fleetrepo ADR 0011 rejected and the tray could not
   show. So the message tells the agent the exact wait to start, in the turn
   the person's message starts anyway; the wait it starts is ordinary,
   visible and stoppable, and wakes it as before. The host-backed test
   scripts the agent's compliance; a real model's is not proven. Making it
   deterministic needs a `processes:command:start` upstream (proposed as a
   follow-up).
2. **"Settled while Pi was down" is Taskfleet's `manifest.updated_at` after
   the branch's last entry.** It also reports a run that settled while the
   previous Pi was idle and not waiting, which the agent had not seen either.
3. **The message is visible in the transcript** as an extension message,
   in English because it is addressed to the agent.
