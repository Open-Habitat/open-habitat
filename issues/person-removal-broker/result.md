# Result: broker side of person removal

The broker implements ADR 0037 sections 1, 5 and 6: `removal_schedule`
(`when`: `now` or `grace`, 14 days) and `removal_cancel` on the gateway
socket; stage 1 close-out at once; the data stage run by the broker itself
at start, hourly and when an immediate removal is scheduled; `removal_pending`
for ensure, authorize, restore and quota operations; `removal_started` for a
cancel after the data stage began; access rows carry the removal (stage, due,
actor, at, fixed reason) and quota rows the due date, counted by kernel usage;
the allocator requires zero kernel usage for a candidate UID under user quotas.

Checks: `./scripts/test-focused.sh --area go --go-package ./internal/provision`
and `./internal/host` green. The fake executor test interrupts every step
(close-out, outside-home, home, kernel usage, quota clear, artifacts) and
repeats to completion; the descriptor deletion of a home runs on a real file
system in `TestRemoveHomeAt`.

**Not run: the privileged lab check on a disposable host.** The build host has
no KVM, so the QEMU guests of `scripts/vm-test.sh` cannot run there, and the
pilot installation is not a disposable host. The native steps (`usermod`,
`loginctl`, `systemctl stop user@`, `userdel`, `groupdel`, `setfacl -x`, the
`/tmp` walk) and the widened broker sandbox are therefore unproven on a real
guest. Every one of them fails closed: a failure holds the removal with a
reason and keeps the binding.

## Decisions for later review

- **The removal entry lives in the admission file (`removals`), keyed by
  subject, with the binding's committed UID and username.** The issue says
  "a `removal` record on a committed binding". Alternative: a field on the
  binding in `bindings.json`. Every stage change is a commit; the admission
  file is the broker's tolerant commit point (an epoch ahead of the
  watermark is recorded by the next exchange), while a ledger write outside
  ensure's journal could leave `bindings.json` and `head.json` disagreeing
  and stop the broker from starting. The UID/username snapshot keeps the
  entry from ever applying to a later binding of the same id. Only the final
  binding drop writes the ledger, in ensure's publish order.
- **The broker unit sees the host's `/tmp` and `/var/tmp`** (`PrivateTmp=no`,
  `ReadWritePaths` for them and the cron, mail and journal spools).
  Alternative: keep the private temporary directories and leave the files to
  tmpfiles ageing. On a single-filesystem host those files count in the
  UID's kernel usage, so the zero-usage proof would hold every such removal.
  The walk is descriptor-relative and never follows a link.
- **`/dev/shm` is left to logind's `RemoveIPC`**, which removes a user's IPC
  objects when their last session ends; `PrivateDevices=yes` hides the host's
  `/dev/shm` from the broker, and that setting protects the block devices.
- **Fixed reasons beyond `files_remain`:** `close_failed`, `admitted` (root's
  `site.json` admits the person again; the data stage waits), `home_unsafe`
  (owner or mount check), `step_failed`. The ADR names only `files_remain`;
  each extra reason points the operator at a different place to look.
- **Schedule replies after the close-out, not after the data stage.** An
  immediate removal wakes the runner; deleting a large home may take minutes,
  far beyond one exchange. The access row shows the progress.
- **A subject with no binding:** schedule drops its admission records and
  answers `removed`, so a repeat after completion is harmless.
- **One removal at a time.** Schedule, cancel and the runner share one slot,
  so a cancel never races a close-out. A cancel that arrives while a long
  data stage of another person runs waits and may time out as uncertain.
- **Host apply re-admitting a person during removal** is not refused at
  apply; ensure and authorize refuse the binding (`removal_pending`) and the
  data stage waits with `admitted` until the operator decides.
