---
created: 2026-11-14
updated: 2026-11-14
type: bug
status: open
priority: high
provenance: chat
source_ref: chat:2026-11-14/pilot-trust-prompt
lane: worker-trust
lane_seq: 1
preparation: ready
---

# Taskfleet Pi workers in a workspace's __worktrees stop at Pi's trust prompt

## Description

## Observed (a pilot installation, 14.11.2026 around 12:00, release v0.1.1)

Three Taskfleet Pi workers started from a Habitat conversation in the
person's repository `~/src/<workspace>` sat at Pi's interactive
"Trust project folder?" prompt for 14 minutes and did nothing. Their
worktrees were under `~/src/<workspace>__worktrees/…`. Nothing told the
person or the conductor conversation; the person noticed and asked. The
conductor unblocked them by adding the `__worktrees` folder to
`~/.pi/agent/trust.json` by hand (another repository's worktree folder was
already there, apparently from an earlier manual fix).

## Expected

Per `project_trust_linux.go` and the runtime `pi` launcher
(`runtime/core/agent-bin/pi`, `TestLauncherAppliesDaemonTrustRule`), a
Taskfleet Pi worker below `~/src` starts with Pi's one-run `--approve`, so
the prompt should never appear. Find why it did (the profile's `pi` not
being the launcher, the worktree path or a symlink not passing the
below-`~/src` check, the launcher missing from the pilot's release, Pi
changing where it asks), fix it, and make a worker stuck on any startup
prompt visible to the conductor (Taskfleet's startup timeout / attention)
rather than silent.
