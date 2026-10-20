---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: high
lane: install-hardening
lane_seq: 1
collision: [install-templates]
---

# Every user sees every other user's processes and command lines

_Source: chat:ville-test-2026-10-20_

## Description

Live isolation check on the test server 2026-10-20 (pilot.237, users maintainer 21032 and ville-svg 21033): homes, Pi auth.json, gh config, /run/user/<uid>, daemon sockets and tmux sockets were all denied in both directions. But /proc is mounted without hidepid, so 'ps -u <other> -o args' as one person lists the other's processes with full argv (daemon config path with username, tmux socket path, and whatever Pi, git, builds or tools put on their command lines: repo names, file paths, potentially tokens). Under the project's model (Unix users are the boundary) this is a product defect.

Fix in the neutral installation templates (systemd/, tmpfiles.d/ or an equivalent mount unit) and document it in docs/operations.md: mount /proc with hidepid=invisible (or 2) and a gid exemption only for components that genuinely need it (check gateway, broker, systemd-logind/polkit, the daemon's own process scans for trash busy-checks and processes, which only need the user's own processes). Verify the daemon's per-user process inspection still works. Fleetrepo applies it to the test server; note what Fleetrepo must change in the report.

Done: on a two-user lab or the test server, one user's ps/proc shows only own processes; trash busy-check, process tray, Taskfleet integration still pass their tests.
