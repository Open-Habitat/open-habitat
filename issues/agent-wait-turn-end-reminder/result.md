# Result

The companion (`internal/daemon/process-extension.mjs`) handles Pi's
`agent_before_settle`. When a run completes normally, it reads pi-processes'
inventory and `taskfleet run list` (1.5 s, whole check bounded at 2 s), takes
the conversation's own live runs (the same `created_by_session` rule as the
catch-up) that no running, agent-waking process covers by the shared wait
grammar, and appends one visible `oh-wait-reminder` custom message with the
ready `taskfleet run wait <ids> --any --output json` command plus one
continuation. The agent either starts the wait or says why not.

"Once per uncovered set" is derived from the branch, as the catch-up's
`reported` is: a run is not reminded while its latest mention is a reminder;
a later waking wait start for that run clears it. So a declined reminder
stands, while a wait that returned (`--any`, `--check-in`) and was not
re-armed is reminded again, which is the 26.10 failure.

Tests (`internal/daemon/pi-device-test/wait-reminder.test.mjs`) cover the
pure rules and the hook against a fake `taskfleet` executable: Taskfleet
error, Taskfleet timeout, an ambiguous process inventory, aborted runs and an
existing continuation give no reminder; an uncovered set is reminded once; a
running waking wait covers; its return without a new wait reminds again.

Not tried with a real model turn: `agent_before_settle` was exercised only
through the hook, with the event shape from Pi 1.3.0's `types.d.ts` and
`agent-session.js`.

## Decisions for later review

- **Repeat rule.** A run is reminded again only after the agent has started a
  waking wait for it since its last reminder. Alternatives: exact-set
  matching (reminds again every time a declined set shrinks), or reminding on
  any new uncovered run only (misses a forgotten re-arm after `--any`).
- **The command lists every uncovered run, at most twenty** (the wait
  grammar's limit), with "and N more" beyond that. `--any` as the result
  recommended.
- **Coverage is the tray's ◉:** a process in status `running` whose own start
  asked to wake the agent (`wakes_agent === true`). A wait with
  `onSuccess: context` does not count, and does not clear an earlier reminder.
- **Skipped boundaries:** an aborted or failed run (Escape, provider error),
  a boundary another handler is already continuing, and Pi saying it cannot
  continue. A run that needs attention, is awaiting input or is stalled is not
  "live" (a default `run wait` would already return for it).
- **The person sees the agent-facing English text** through the generic
  extension-message rendering. The catch-up has a Finnish projection in the
  daemon (`restart_linux.go`); doing the same for the reminder would touch the
  daemon, the contract and the web, and was left out of this companion-only
  change.
