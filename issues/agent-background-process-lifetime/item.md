---
created: 2026-11-13
updated: 2026-11-13
type: bug
status: fixed
priority: normal
preparation: ready
lane: agent-guide
lane_seq: 1
collision: [internal/daemon/host-context.md]
closed: 2026-11-13
---

# The agent cannot say whether its background processes survive a new conversation

## Observed

At the end of a handoff, a Habitat conversation's agent told the person:
"I don't know whether this conversation's background processes stay alive
when you start a new one", and listed a long-running endurance test, an
import monitor and a tunnel as at risk. The person had to guess.

## Expected

The agent knows how its environment treats background processes and can
advise: what survives a new conversation, an idle conversation, a closed
browser, a daemon restart and an upgrade, and where to run work that must
outlive the conversation.

## Facts from the code (13.11.2026)

- Starting another conversation does not touch this one.
- An idle conversation's Pi is stopped after the idle timeout only when
  its process bridge reports nothing still running
  (`classify` / `backgroundActivity` in `internal/daemon/pi_activity_linux.go`);
  a process started with the process tool keeps the conversation alive.
- Pi and its children are daemon children: a daemon restart or an upgrade
  ends them, and with them the process-tool processes and waits.
- Taskfleet workers and the browser shell (tmux) are user units and
  survive daemon restarts; work that must survive belongs there (or in a
  `systemd-run --user` unit), with its output in a file.

The agent guide (`internal/daemon/host-context.md`) says none of this.

## Next action

Add a short, accurate passage to the agent guide (and the agent skill if
that is where it belongs) so the agent can answer this itself. Reported by
Jari 13.11.2026; agent-facing text, so Jari proofreads it before the pilot
release.
