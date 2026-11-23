# Result

Each person's daemon instance `open-habitat-daemon@<user>.service`, with
every Pi conversation and tool it starts, now runs in that person's
`user-<uid>.slice`. One operator drop-in in `/etc/systemd/system/user-.slice.d/`
bounds everything a person runs. There is no new product setting, and
without an operator limit nothing is bounded, as before.

## What changed

- The broker's `unit` provisioning step writes
  `/etc/systemd/system/open-habitat-daemon@<user>.service.d/open-habitat-slice.conf`
  (`[Service] Slice=user-<uid>.slice`, plus a comment), reloads systemd, and
  `unit()` then requires the effective `Slice=` and that this file is the
  instance's only drop-in. The activation gate and broker startup run the same
  check, so a missing or foreign drop-in refuses activation rather than quietly
  running the daemon outside the person's budget.
- `provision.EnsureDaemonSlices` runs in host apply/upgrade `activate`, under
  the broker ledger lock and before the reload, and adds the drop-in for every
  committed binding that is not under removal. The upgrade stops daemons before
  this step and starts them afterwards, so an existing install moves on upgrade.
- The host verifier (`unitOverridesSafe`) accepts that one file only in
  `/etc/systemd/system`, only as the sole `.conf` in the instance directory, and
  only with exactly the broker's bytes (root, 0644, not a link). Every other
  override is still refused. The probe instance `verifyUnitPolicies` inspects is
  now `0-host-qualification`, which cannot be a username.
- Person removal (`RemoveArtifacts`) deletes the drop-in and its directory.
  `available()` refuses a new binding while one is left behind.
- The unit template is unchanged. `verify-release.sh` now refuses a template
  `Slice=`, which would put everyone's daemon in one shared budget. A negative
  repack was refused.
- `docs/operations.md` describes what a user-slice limit covers, with an
  example drop-in.

## Checks

- `./scripts/test-focused.sh --area go` for `internal/provision` and
  `internal/host` under `umask 077`: pass.
- A release archive was packaged and verified with `verify-release.sh`: pass.
  A repack whose template carried `Slice=` was refused.
- The operator's installation tooling: the shipped unit inventory and bytes are
  unchanged, so a test-release archive inspection is unaffected, and its live
  checks look only at socket units' drop-ins. No change was needed there.
- Live experiment in a disposable rootless systemd container (Ubuntu 24.04,
  systemd 255.4) with the product's units, a stand-in binary and the product's
  own drop-in code. The evidence is in
  the conductor's evidence directory for this issue (`README.md`,
  `experiment.log`).
  - Before the drop-in the daemon ran in `system-open-habitat-daemon.slice`.
    After the broker's write and a restart it ran in
    `/user.slice/user-32000.slice/open-habitat-daemon@alice.service`.
  - An operator `user-.slice.d` limit of `MemoryMax=256M` OOM-killed the
    daemon's runaway child (`oom_kill 1`). The daemon kept running
    (`OOMPolicy=continue`, `NRestarts=0`).
  - The daemon stayed up through linger, a login session and logout with
    `KillUserProcesses=yes`, `disable-linger`, and `loginctl terminate-user`.
  - Removal deleted the drop-in, and the unit fell back to its template slice.
- `/llm-review` (finder gpt-6-astra, verifier claude-fable-5-2) produced one
  confirmed finding: a valid username `host-qualification` collided with the
  verifier's probe instance. It is fixed in `c8f3ce26a`. `/assess-findings`:
  FIX 1. Nothing was left to file.

## Decisions for later review

- **The drop-in lives in `/etc/systemd/system`, written by the broker, and
  apply/upgrade migrate existing people.** `/run` with a rewrite at every boot
  was the alternative, but it would need new broker write access to
  `/run/systemd/system` and would leave the upgrade's daemon restart racing the
  broker's startup. Host maintenance calls a provision function, and the broker
  package keeps ownership of the file's format.
  Live check: after the next upgrade on a pilot,
  `systemctl show -p Slice,DropInPaths open-habitat-daemon@<user>.service`
  shows `user-<uid>.slice` and only the product file.
- **The broker requires the slice before activation.** A missing drop-in
  refuses activation, and at broker startup it blocks the broker the way other
  drifted bindings already do, instead of silently running unbounded. This is
  safe because apply/upgrade write the drop-ins before anything starts.
  Live check: after the upgrade, broker startup logs `service_ready` with no
  `unit_probe` guard event.
- **logind keeps a person's user record while their daemon runs.** The slice is
  active, so without linger and with no session, `user@<uid>.service` stays up
  while the daemon does. Every person has linger anyway, and removal stops the
  daemon before it ends the user manager, so nothing changes in practice.
  Live check: none needed beyond the experiment log.
