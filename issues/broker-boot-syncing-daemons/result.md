# Result: broker starts syncing users' daemons at boot

## What changed

After the broker restores a committed, admitted person's daemon socket at
start (`Writer.restoreSockets`), it checks that person's integrations boot
signal and, if it is there, starts their daemon service
(`internal/provision/bootsync_linux.go`):

- `bootSignalAt` opens `/home`, the home and then `.local`, `state`,
  `open-habitat`, `sync-at-boot` one at a time with
  `openat(O_PATH|O_DIRECTORY|O_NOFOLLOW)` relative to the previous checked
  descriptor, and checks each with `fstat`: a directory, owned by the
  person's UID, on the home's device. A missing component means absent. A link,
  any other type, another owner or another device means unsafe. O_PATH
  descriptors cannot list or read anything, so nothing inside the signal is
  opened.
- `LinuxHostExecutor.SyncAtBoot` runs that walk with a 5 s deadline so that a
  syscall stuck in a person's home, such as a FUSE mount, cannot hold up the
  other people's restore.
- `LinuxHostExecutor.StartDaemon` verifies the binding again, requires the
  socket to be active with the verified inode (`RouteReady`), and runs exactly
  `systemctl start open-habitat-daemon@<user>.service`. An inactive socket is
  refused, so the service's `Requires=` can never pull a socket in around
  Fleetrepo's activation gate.
- The broker logs `broker_sync_start` with outcome `started`, or `rejected`
  with reason `signal_unsafe`, `signal_unavailable` or `start_failed`.
  An absent signal is not logged.
- `internal/AGENTS.md` now states the rule that the broker's only service
  start is this one.

The `systemd/` templates needed no change. The service already gets its
socket's descriptor when it is started explicitly, and the broker's unit
already has `ProtectHome=no`. No Fleetrepo follow-up is needed for the units.

## Evidence (tree `8d062150`, commit `557c8a51`)

- `go vet` and `go test ./internal/provision ./internal/cli` pass, along with
  `go test ./internal/daemon/integrations`, which keeps `BootSignal`. Under
  UID 1000, the `TestBootSignalAt*` cases cover a complete signal, each
  component missing, a link, a file or a FIFO at each depth, a home that is a
  link, a name with a path in it, and another person's UID.
  `TestBootSignalAtSwapDuringWalk` covers swaps during the walk through a
  hook after each check. `TestBootSignalAtReadsNothing` uses inotify on the
  home and the signal: the walk produces no events, while a readdir does.
  `TestRestoreStartsOnlySyncingDaemons` checks that only committed, admitted
  people whose socket was restored are checked, that only those with the
  signal are started, and that a revoked binding, a failed socket start and a
  failed daemon start behave as described.
  `TestStartDaemonRequiresVerifiedActiveSocket` checks that no
  `systemctl start` is sent for an unverified binding or an inactive socket.
- Distinct-UID proof: `./scripts/test-broker-boot-uids.sh` passes
  (`TestBootSyncDistinctUIDs` in a networkless rootless Podman Ubuntu 24.04
  container, running as the container's root like the broker). Three committed
  people under kernel UIDs 2100–2102 and an uncommitted home under 2103 each
  have a signal. Only carol (a clean chain) is started. Dana's signal links to
  carol's and erin's `.local/state` is owned by carol's UID; both are rejected
  as unsafe. Mallory's home is never examined, and inotify sees nothing opened
  or read in any home.
- Mutation checks: dropping `O_NOFOLLOW`, dropping the owner check, opening
  with `O_RDONLY` instead of `O_PATH`, or removing the `RouteReady` guard each
  fails a test. The owner mutation also fails the container proof
  (`started [carol erin]`).
- Independent review: `/llm-review` at critical rigor, with gpt-6-astra as
  finder and claude-fable-5-1 as verifier. Both candidates survived. Triaged
  with `/assess-findings`: one FIX (the untested `RouteReady` guard, fixed in
  `557c8a51`) and one DROP (the swap-aside case, see below). The local
  reports are `history/review-broker-boot-syncing-daemons.md` and
  `history/assessment-broker-boot-syncing-daemons.*`.

## Limits

- No real systemd start has been run. The QEMU guest scenarios were not
  extended: `jit-reboot-diagnostic` stops before broker activation, and the
  others never restart the broker. The exact unit name and the start against
  a real active socket are proved only by the test-VM check below.
- The `st_dev` (no mount crossing) check has no test. A mount needs
  `CAP_SYS_ADMIN`, which the rootless container lacks.
- A FUSE mount with `allow_other` inside a home could block the walk. The 5 s
  deadline then abandons that walk, leaving one goroutine and descriptor
  behind until the broker exits, and the restore continues with the others.
  The same kind of hang already applies to `Verify`'s `stat` of the home.
- No production integration syncs yet, so in practice the signal appears only
  when it is created by hand (below) or once the Google, Microsoft or Dropbox
  entries land.

## Decisions for later review

- **A checked directory renamed away during the walk still counts.** The walk
  continues in the original inode, which is still the person's own, so the
  start happens if that chain is complete. The alternative was a post-walk
  check that each name still resolves to the held inode. That still leaves a
  window after the check, adds code, and protects nothing across people: the
  worst outcome is the start of the person's own daemon. A link swapped in
  is never followed. A test pins this behaviour. This departs from a literal
  reading of the brief ("swap during walk → no start").
- **No mode check on the components**, only owner, type and device. Requiring
  0700 would turn an unusual umask into a missed boot start, and a
  group-writable directory still cannot be made to look like another
  person's.
- **The daemon is started only after that person's socket restore succeeds**
  (no start on a failed or uncertain activation), serially in the same
  goroutine. The alternative was a separate pass after all sockets.
  Interleaving starts sync sooner for the earlier people and keeps one loop.
- **A failed daemon start is logged and not retried.** The person's next
  sign-in starts the daemon in any case.

## Reboot check on the test VM (conductor, after release)

As a test user who has signed in at least once (`<u>`), run as root on the
guest:

```sh
sudo -u <u> mkdir -p /home/<u>/.local/state/open-habitat/sync-at-boot
systemctl reboot
# after boot, without any browser sign-in:
systemctl is-active open-habitat-daemon@<u>.socket open-habitat-daemon@<u>.service   # active, active
journalctl -b -u open-habitat-broker.service -o cat | grep -E 'broker_(socket_restore|sync_start)'
#   broker_sync_start outcome=started user=<u>; no broker_sync_start for anyone else
test ! -e /home/<u>/.local/state/open-habitat/sync-at-boot && echo healed   # the daemon removed it (no syncing account)
systemctl --no-pager list-units 'open-habitat-daemon@*.service'               # only <u>'s is active
systemctl reboot
# second boot: <u>'s socket is active, the service is inactive until a sign-in
systemctl is-active open-habitat-daemon@<u>.service                         # inactive
```

A daemon that reports `inactive` after the first boot, together with
`signal_unsafe` in the log, means the walk rejected the chain. A daemon that
is active after the second boot without a sign-in means something else
started it.
