# Result

## Reproduction (Birch, systemd 255, 2026-10-31)

A disposable user unit, `systemd-run --user -p MemoryMax=64M -p MemorySwapMax=0`,
ran `/bin/sh` with a long-lived `sleep 600` sibling and a `timeout 20`
Python memory hog:

- Default policy (`DefaultOOMPolicy=stop` for both managers): the hog was
  OOM-killed (exit 137). systemd then logged "A process of this unit has been
  killed by the OOM killer" and "Failed with result 'oom-kill'", and the
  whole unit stopped, sibling included.
- `-p OOMPolicy=continue`: the hog was OOM-killed the same way, but the unit
  stayed `active (running)` and the sibling `sleep` survived.

So the issue is real for any unit whose processes include work an agent
started. That applies to `open-habitat-daemon@.service`, where Pi conversations
and everything they start run as the daemon's children in its cgroup.

The tmux unit is less exposed than the issue assumed. Birch's tmux 3.4 is
linked against libsystemd and moves each new pane into its own
`app-tmux.slice/tmux-spawn-<uuid>.scope`, verified in a disposable
`oh-oom-tmux` unit. The tmux unit then holds only the server, and an OOM kill
in a pane stops only that pane's scope. The unit is exposed when tmux cannot
reach systemd and keeps panes in its own cgroup, as with a tmux built
without systemd or with an unreachable user bus. The editor
(`open-habitat-editor`, code-server and its node children) is exposed the
same way as the daemon.

## Change

- `systemd/open-habitat-daemon@.service`: `OOMPolicy=continue`. An OOM kill
  of the daemon's main process still fails the unit, and `Restart=on-failure`
  restarts it.
- The `systemd-run --user` calls for `open-habitat-tmux` and
  `open-habitat-editor` pass `-p OOMPolicy=continue`.
- Tests: `scripts/verify-release.sh` rejects a packaged daemon unit without
  `OOMPolicy=continue`. Checked both ways: the real package verifies, and a
  package built from the template with the line removed is refused. The
  terminal and editor tests assert the property in the `systemd-run` argv.

## Fleetrepo

No Fleetrepo change is required. Fleetrepo's test-release daemon contract
(`infra/open-habitat-test/six_unit_contract.py:daemon_contract`) checks only
required keys and accepts the new unit (run against it: `True`). The test
server installs the packaged unit, and Birch's `host apply` writes
`policy.DaemonService`, so both pick the change up from the release. Optional
tidy-up: `infra/open-habitat-test/unit_fixtures.py:DAEMON_SERVICE` could gain
the line so the fixture keeps matching the product unit.

Already-running `open-habitat-tmux` and `open-habitat-editor` transient units
keep their old properties until their next start. The daemon unit gets the
new policy at the upgrade's daemon restart.

## Decisions for later review

- **The editor unit as well, not only daemon and tmux.** The alternative was
  leaving the editor on `stop`. It has the same exposure (extension hosts and
  terminals are its children), and losing the whole editor for one OOM-killed
  child is the same failure the issue describes.
- **`continue` rather than `kill`.** `kill` would still end every process in
  the unit. `continue` relies on the main process failing the unit when it is
  the one killed, which `Restart=on-failure` (daemon) and the browser's
  reconnect (tmux, editor) already handle.
- **No policy for the per-pane scopes.** tmux creates them and the product
  cannot set their properties. Each scope is one pane, so `stop` there ends
  only the shell whose process ran out of memory.

## Not covered

A host-wide (global) OOM was not provoked on Birch, where other workers run.
The cgroup-limited OOM above exercises the same systemd OOM-policy path.
