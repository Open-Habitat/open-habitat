---
created: 2026-11-27
updated: 2026-11-27
type: bug
reporter: agent
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Agent guide: the agent's /tmp and /var/tmp are not shared with the terminal

## Observed (reported 27.11.2026 by an agent on a pilot installation)

An agent wrote a helper binary under `/var/tmp` and asked the person to run a script from the
Habitat terminal; the terminal could not see the file, because a browser-started agent's
`/var/tmp` is the daemon's private bind (`/var/lib/open-habitat-tmp/<user>`), not the host's
`/var/tmp` that the terminal, Taskfleet workers and SSH see. (`/tmp` is private too.)

## Done when

The agent guide (`internal/daemon/host-context.md`) says in one or two sentences that the
agent's `/tmp` and `/var/tmp` are its own and not shared with the person's terminal, workers
or SSH, and that files the person or another process should use belong in the home directory
or a workspace. The agent skill and the upgrade announcement text (which already mention
`/var/tmp`) stay consistent with it.
