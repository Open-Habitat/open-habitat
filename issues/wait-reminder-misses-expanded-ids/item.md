---
created: 2026-11-01
updated: 2026-11-01
type: bug
reporter: jari
status: open
priority: normal
lane: wait-reminder-misses-expanded-ids
lane_seq: 1
preparation: ready
---

# Turn-end reminder ignores a running wait whose run ids the shell expands

Jari 1.11.: the conductor started a waking `taskfleet run wait` whose run
ids came from a file (`taskfleet run wait $(tr '\n' ' ' < active.txt) --any
…`). The process ran and would have woken the agent, but Habitat's turn-end
reminder still said "nothing is waiting for them" and listed all eleven runs,
so the agent restarted the wait with literal ids.

Cause: `waitRuns` in `internal/daemon/process-extension.mjs` reads run ids
only from the command text and deliberately refuses any shell expansion
(`waitRefused`, `waitExpanded`), so a wait whose ids are expanded by the
shell covers nothing.

Fix so a real running wait is recognised: when a waking process's command is
not statically parseable, read the run ids from the live `taskfleet run
wait` process the shell started (its real argv under the process's pid, e.g.
`/proc/<pid>/task/*/children` → `/proc/<child>/cmdline`, same UID only),
bounded and failing to "unknown". Unknown must not produce a false "nothing
is waiting" for runs it might cover: either stay silent about runs while an
unparseable wait is live, or say in the reminder that a wait was found whose
runs could not be read and that literal ids make it recognisable. Keep the
static parser as the first path. Tests for both.
