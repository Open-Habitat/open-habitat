# Result

`host upgrade` now stops and restarts only the product's system units
(gateway, revoke socket, broker, and each person's daemon and agent units). It
no longer runs `systemctl --user stop`/`start` on a person's user-manager units
and no longer requires the same set of user units to be active after the
upgrade. The preview's `work` still lists each account's user units, now as
`user_units_left_running` with `user_units_observable`; the list is only a
report, so a unit that is starting, has an escaped name or cannot be listed no
longer blocks the plan. Only a live product daemon makes
`interruption_required` true; user units alone need no `--approve-interruption`.
Active turns are still reported as before.

`docs/operations.md` now says that the browser shell, editor, Taskfleet runs
and timers keep running on the generation they started with, that browser Pi
conversations are still cut, and that a security fix for a long-running user
process means restarting that process on purpose. `internal/AGENTS.md` adds the
rule to the `host/` paragraph.

## Real-systemd evidence

`python3 scripts/cloud-qualify.py run` passed on a fresh Hetzner cx33 (fsn1)
with stock Ubuntu 24.04 ([receipt](receipt-cloud-qualify.json); only the
destroyed VM's address is redacted). Run `20261025t192424-1c5fb8`, harness
`87741bc0`, clean tree. Afterwards `open-habitat-qualification-vm list` on Alder
showed no resources, and teardown deleted the server, volume, firewall and key.

- Predecessor: the published 0.1.0-pilot.11 amd64 (package `9c2fcdca…`, the
  pinned bytes kept on Alder from its release).
- Successor: `0.1.0-pilot.11-hostup.1`, built from `2cdcd3fe` (binary
  `673b2280…`, manifest `4d6e92e5…`). It reuses pilot.11's twelve archives and
  is signed with the existing development key as the named upgrade from
  pilot.11. It is not published.

New qualification probe: as the first synthetic person, through their lingering
user manager, `systemd-run --user --collect --unit=… /bin/sleep infinity`
starts a transient service, the same shape as the browser shell's tmux and a
Taskfleet supervisor. It also records the service's `MainPID`.

- `qualification-survivor-quiesce.service` was started before the owner's
  first invocation. That invocation ran quiescence and was SIGKILLed at
  `activating`. Afterwards the service was still `active` with the same PID
  (3720).
- After the fenced reboot, `qualification-survivor-activate.service` was
  started before the continuation. The continuation ran to `upgraded`, and the
  service was still `active` with the same PID (1342).
- The exact repeat returned `no_change`. The gateway executable equals the
  successor binary, public HTTPS stayed closed during the fenced boot, and the
  final cold boot passed every check.

With the old code, the first unit would have been in the recorded list and
stopped during quiescence. The first check fails on exactly that
(`user_unit_interrupted`), and `scripts/test-cloud-qualify.py` covers this with
a fake owner that stops user units, with and without the interruption.

Run 1 (`20261025t185840-8e00da`) failed at `first_use` on a stale
harness expectation. pilot.11's catalog shows the Apple tile, and the harness
did not know about it. `87741bc0` fixes the expectation. That VM was also
destroyed.

## Checks

- `./scripts/test-focused.sh --area go --go-package ./internal/host` passed.
  The new tests are `TestUpgradeInterruptionFollowsDaemonsOnly` and
  `TestUpgradeUserUnitInventoryIsReportOnly`. The selector test for the removed
  `safeUserUnit` was deleted with the function.
- `./scripts/test-host-initialization-uids.sh` (root container, 24 `TestUpgrade*`
  passes) passed.
- `python3 scripts/test-cloud-qualify.py` passed (20 tests).
- `go vet ./internal/host ./internal/cli` reported nothing.

## Limits

- The qualification proves one transient service per phase in one account. It
  did not exercise a real tmux server with pane scopes, a Taskfleet run, or the
  editor. All of them are transient user services in the same manager, which
  the change no longer touches at all.
- I did not run the old code on the VM. Its failure on real systemd is the
  research's replay (`upgrade-keeps-agent-processes`, research § 2c). Here, the
  discrimination against the old behaviour is proven by the offline fake.
- The preview's `user_units_left_running` field is not captured by the
  qualification receipt.
- Birch, the pilot and the test server were not touched. Birch's next upgrade
  is the first live use.

## Review

`/llm-review` at critical rigor. Finder: gpt-6-astra, no findings. Verifier:
gpt-6.1-sol, asked one focused false-negative question about same-UID processes
in the user manager during the fenced window. It found no path to the
preservation proof (broker token and gateway state are root- or gateway-private)
and no path to predecessor adoption (`current` switches before per-user sockets
return, and adoption checks the system unit's executable path and digest). Its
one candidate was a person SIGSTOPping their own daemon. `/assess-findings`
dropped it (rule 1b): it is pre-existing, not cross-user, and was equally
possible from SSH/tmux before this change. claude-fable-5-1 was the intended
verifier, but its claude-cli backend exited 1 with an empty error on every
call.

## Decisions for later review

- **User units are still reported.** Removing the inventory entirely would be
  simpler. I kept it because the operator can then see what will keep running
  on the old generation. It is best effort and never blocks.
- **Unpushed successor build.** `prepare-test-release.sh --ungated` refuses
  source that is not on `origin/main`, and this worker must not push. On Alder
  I ran its build steps directly from a clean detached worktree at `2cdcd3fe`
  (`npm ci`, `npm run build`, `package-release.sh`, `verify-release.sh`; no
  warnings). The worktree has since been removed. This was qualification only,
  not a test release.
- **No unit or socket template changed**, so Fleetrepo's installation needs no
  change.
- The upgrade proof keeps `schema_version` 1 even though its user field changed.
  The proof is written and read by the same owner binary within one operation.
