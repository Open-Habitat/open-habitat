# Result

The host guide now explains beside the editor and shell guidance that the
browser agent's `/tmp` and `/var/tmp` are private to the daemon, not shared
with the person's terminal, Taskfleet workers or SSH sessions. Shared files
and surviving work's output are directed to the home directory or a workspace.

Verified against `systemd/open-habitat-daemon@.service` (`PrivateTmp=yes` and
its persistent per-user `/var/tmp` bind) and the existing stop investigation
in `issues/upgrade-announced-to-agents/stop-behaviour.md`. The agent CLI skill
contains no contrary advice and needed no change; upgrade texts are unchanged.

Validation: `umask 077; ./scripts/test-focused.sh --area go --go-package
./internal/daemon` passed, including the new guide contract test. The first
attempt exceeded the harness's 200-second timeout; the complete retry passed
in 251.689 seconds. `git diff --check` passed. No live service was restarted
and the existing operating-system experiment was not repeated.
