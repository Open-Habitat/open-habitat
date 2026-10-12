---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: open
priority: high
lane: signin-fix
lane_seq: 1
collision: [internal/provision/]
---

# First sign-in fails: daemon gate path renamed in product only

_Source: chat_

First sign-in on the pilot.20 test installation fails for every browser. The gateway shows "Kirjautumisessa tapahtui virhe"; its journal has `oauth_callback rejected broker_denied broker_operation=ensure broker_reason=state_unavailable` (2026-10-12 06:27 and 06:50 UTC). The broker created the account and published the binding (UID 21032), then `Writer.Handle` returned `state_unavailable` because `LinuxHostExecutor.Ready` refused to start `open-habitat-daemon@<user>.socket`.

Cause: `exactGateExec` in `internal/provision/executor_linux.go` pins the gate command to `/usr/local/libexec/open-habitat-test-jit/jit_policy.py`, a path the rename introduced. Fleetrepo installs and declares the gate at `/usr/local/libexec/native-agent-host-test-jit/jit_policy.py` (main, `fresh_six_install.py`, the gate units). Running that gate by hand for the bound user returns `verified`; the unit never ran because the broker rejected it first.

Fix: make the product's pinned gate path match what Fleetrepo actually installs, with a regression test that fails on drift, then release and deploy so Jari can sign in. Fleetrepo owns the guest's libexec layout; renaming it there is a separate, optional change.
