# Result

The daemon unit keeps `PrivateTmp=yes` for `/tmp` and binds
`/var/lib/open-habitat-tmp/<user>` onto `/var/tmp`. systemd creates that
directory as the user, 0700, under a root-owned 0755 parent
(`StateDirectory=open-habitat-tmp/%i`, `StateDirectoryMode=0700`,
`BindPaths=/var/lib/open-habitat-tmp/%i:/var/tmp`). The tmpfiles policy ages
it like the host's `/var/tmp`: `e /var/lib/open-habitat-tmp/* - - - 30d`.
`verify-release.sh` refuses a package without these settings, the package
regression covers three mutations, `policy_test.go` checks the embedded
bytes, and `docs/operations.md` and `AGENTS-WORKFLOW.md` say where agents'
`/var/tmp` lives.

## What was proved and what was not

On Birch (Ubuntu 24.04, systemd 255.4), `probe-unit.sh` started transient
system units with the exact `[Service]` directives of the unit (ExecStart
replaced by a probe, the state directory renamed so that the real path stayed
untouched):

- run 1 as maintainer wrote markers; run 2 as the same account found the
  `/var/tmp` marker and no `/tmp` marker. `/var/tmp` was mounted from
  `/var/lib/oh-r55-probe/maintainer`, and `/tmp` was a fresh
  `systemd-private-*` directory each time;
- a run as `nobody` saw its own empty `/var/tmp` and was denied the first
  account's directory and file;
- on the host the parent was root:root 0755 and each account's directory was
  0700, owned by that account;
- `systemd-tmpfiles --clean` with the same `e` line at a 1 s age removed the
  contents and kept both directories, with their mode and ownership;
- `systemd-analyze verify` accepted the unit.

Not proved: a restart of the real `open-habitat-daemon@` unit (forbidden on
Birch; the transient unit is a separate service with the same directives), or
the `host upgrade` that first installs these bytes.

Fleetrepo's archive gate (`fresh_six_preflight.inspect_archive`, which the
release watcher uses) accepts an amd64 package built from this tree as it is,
and `six_unit_contract.daemon_contract` holds. So no Fleetrepo change was
needed. The test guest never applies product tmpfiles.d, so nothing is aged
there; that server is disposable.

Checks: `go test .`, `test-focused.sh --area go --go-package ./internal/host`,
`verify-release.sh` on a fresh arm64 package, `test-package-socket.sh` (all
mutations rejected; the two new tmp cases were checked by their messages),
`validate-project-view.py`. Review: independent `/llm-review` (gpt-6-astra
as finder, claude-fable-5-1 for a focused false-negative pass against the
systemd v255.4 source). No findings.

## Decisions for later review

- **Where the persistent `/var/tmp` lives: under `/var/lib`, not in the home.**
  The alternative was a directory in the home (e.g. `~/.local/state/…`),
  where the quota would count it. On systemd 255, though, nothing can safely
  create a directory in the home before the mounts are set up. `%h` is
  `/root` in system units, a root `ExecStartPre=+` would follow
  user-controlled symlinks, and making the broker create it would extend
  root's authority. `StateDirectory` is created by systemd itself, as the
  user, under a parent nobody else can write, and Ubuntu's own `/var/tmp`
  (and today's private one) also sits on `/var` outside quotas. The cost is
  that one person can fill `/var`, as they can over SSH. 30-day aging bounds
  forgotten files, not deliberate use.
- **30 days of aging**, the same as Ubuntu's `/var/tmp`. The alternative was
  no aging (only the quota would apply, and it does not apply on `/var`).
- **The agent's `/var/tmp` is not the host's.** The browser shell and Taskfleet
  workers (user manager) see the host's `/var/tmp`; agents in the daemon see
  their own directory, which the shell reaches at
  `/var/lib/open-habitat-tmp/<user>/`. Unifying them would mean either
  sharing the host's `/var/tmp` with the daemon (which drops PrivateTmp's
  separation) or giving the user manager a namespace. Neither is a decision
  for this bug.
- **Account deletion and name reuse.** systemd would hand a deleted account's
  directory to a new account with the same name. The product never deletes
  accounts; the operator guide tells operators to remove the directory along
  with the account.
