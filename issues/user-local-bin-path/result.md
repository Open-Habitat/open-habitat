# Result

The per-home child PATH is shared by Pi, Taskfleet, browser tmux shells and code-server: `~/.local/bin`, `~/.cargo/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`. Cargo's native installer uses `~/.cargo/bin`; no speculative tool-specific directories are added. These entries exist in PATH before installation, so subsequent child processes discover newly installed executables without a profile or daemon restart.

Pi conversation start/resume/held-message/title paths and Taskfleet already used the per-home policy. Browser shells and the editor now use it instead of the daemon's inherited PATH. Taskfleet transcript enrichment uses it too. New tmux sessions explicitly receive PATH, including when the tmux server survived a previous daemon. Existing shells retain their own environment; open a new shell after upgrading.

Host-managed Git, runtime-validation and credential/onboarding helpers retain their absolute executables and restricted PATHs. No profile files, provisioning configuration, account authority or cross-UID policy change is needed.

## Review

Focused self-review: this is same-UID child environment construction using the already verified home, not a Unix-user isolation, authority or installation-hardening change. Checked Pi launch callers, Taskfleet executable selection, tmux/systemd propagation, editor/systemd propagation, and restricted internal helper environments. No browser presentation changed, so no visual captures apply.

## Validation

Tested the runnable diff based on `43965dd6` (the fix commit carries this result):

- `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`: passed; existing optional peer-version/deprecation warnings only.
- With `umask 0077` and `TMPDIR=/var/tmp`, `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed, race-enabled, 69.388 s.
- `./scripts/test-focused.sh --area contracts`: passed generated drift and validation (54 schemas, 51 fixtures, 36 scenarios, 17 negative checks).
- Explicit verbose rerun of the four path regressions: all passed, none skipped. Covers per-home fake Pi children, restricted host Git, shell/editor tool discovery after environment construction, and real browser-terminal protocol/tmux new-shell discovery with stale server PATH.

The first daemon suite attempt failed with the inherited `umask 0002`: synthetic homes were group-writable, so credential/home checks rejected them and dependent tests cascaded. Repeating the unchanged runnable tree with private fixture creation passed. Two initial source-discovery commands used nonexistent globs/paths (including a guessed skill path); corrected scoped lookups supplied the needed sources. No required validation remains failed or incomplete.

All fixtures are synthetic and same-UID. This establishes environment propagation, not new cross-UID isolation evidence or live installer/provider behavior. No test server or Fleetrepo changes were made. Existing shell/editor processes need reopening after deployment to receive the new environment.
