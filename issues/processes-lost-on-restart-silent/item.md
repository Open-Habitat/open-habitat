---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: fixed
priority: normal
lane: pi-runtime
collision: [internal/daemon]
preparation: ready
closed: 2026-10-16
---

# Background processes killed by a daemon restart vanish without a trace

Jari, 2026-10-16 ~19:25 local, live test: a background process started by the parent agent with Pi's `process` tool died when the daemon restarted (release pilot.183); processes live in the daemon's cgroup, so systemd stops them. Back in the conversation the process had simply vanished from the list; nothing says it was killed by a restart, and the agent is not told either.

Keep a trace: the process tray shows the process as ended by a server restart (from the pi-processes record or the daemon's own knowledge at shutdown, no new store of truth), and on the next resume the agent learns which of its processes were cut off, like `spinoff-catch-up-on-resume` does for spinoffs (same mechanism, same message, context-only). Whether processes should instead survive daemon restarts (own user units like Taskfleet) is a separate architecture question; record the trade-off in result.md as a recommendation for Jari.

## Acceptance Criteria
- [x] After a daemon restart, a killed background process shows as ended by restart in the tray (browser test).
- [x] The resumed agent's next turn sees which processes were cut off (test).
