# Result: installations without a separate quota-enabled /home

## What changed

A site declares `storage.enforce_user_quota: false` (and no
`default_limit_bytes`) to install on an ordinary single-filesystem server.
`storage.home_uuid` is then the UUID of whichever ext4 filesystem holds
`/home`, normally the root filesystem (`findmnt -no UUID -T /home`).

- **Host check/plan/prepare.** `storage.home` accepts `/home` on the root
  filesystem (`home_on_root_filesystem_observed`) or a dedicated mount; the
  quota format and enforcement checks pass as `user_quota_not_declared` and
  never query quotas. The UUID, device, ext4 superblock and pinned mount are
  still bound. Preparation runs no EDQUOT probe and installs
  `storage-policy.json` with `user_quota: false`; its proof records
  `no_user_quota` and never satisfies a quota site (or the reverse). A quota
  site on the same host still fails with `separate_home_required`.
- **Boot gate.** Reads the mode from the installed policy and, without
  quotas, verifies only the home filesystem's identity and mount pin.
- **Broker.** Reads the mode from root's installed policy at startup and in
  the binding gate (an unreadable policy stops it). Without quotas it accepts
  `ensure` with no default limit, sets no quota, restores bindings without a
  quota read, answers `quota_read`/`quota_list` with `not_in_use` plus the
  filesystem, and refuses `quota_set` with `quota_not_in_use`.
- **Gateway.** No longer refuses a login itself for a missing default limit;
  the broker decides (in quota mode the broker still refuses, and the gateway
  keeps the `quota_default_missing` diagnostic and 503). Account and server
  storage carry `limits: enforced|not_in_use`; a limit write answers 409
  `storage_limits_not_in_use`.
- **Daemon.** Agent environment reports `quota.state: not_in_use` and clone
  admission uses free filesystem space, but only when the installed policy
  positively says so; an unreadable policy keeps quota behaviour.
- **Browser.** Settings › Tallennustila shows the shared disk and says limits
  are not in use; the pressure notice warns about the shared disk at 90 %; the
  clone page shows free space on the shared disk; the administrator page hides
  the default limit and per-user limit editing and shows "Ei rajaa".
- **Apply.** Skips default-limit convergence and readback without quotas.
- **Docs.** `docs/operations.md` (two modes, home UUID, free-space
  operation), `internal/AGENTS.md` (who decides the mode; what the mode does
  not protect against), `TESTING.md` (new VM scenario), `KOKEILTAVAA.md`.

The quota mode is unchanged: every existing quota test passes, the broker in
quota mode still refuses an ensure without a default and a binding without a
limit, and an earlier installed immutable-identity file stays byte-identical
(`no_user_quota` is omitted when false).

## Evidence

See the commit trailers for the change set. Checks run in this worktree are
listed in the run's final report and below as they complete.

## Decisions for later review

- **Mode is immutable.** The storage mode is part of the installation's
  immutable identity (`Immutable.NoUserQuota`). Switching a running
  installation between modes is a fresh installation, so accounts never
  silently gain or lose limits. A migration path (e.g. adding a quota volume
  later and setting limits on existing accounts) is not built.
- **ext4 only in both modes.** The no-quota mode still requires ext4 for
  `/home` (Ubuntu's default). XFS/btrfs roots are refused.
- **Site field kept as a boolean.** `enforce_user_quota: false` selects the
  mode; no new `storage.mode` field. `default_limit_bytes` must be absent
  (even 0) without quotas.
- **No product-side space accounting.** Without quotas the person sees only
  the shared disk (capacity/free), never their own usage: a `du` of the home
  would be a second, unenforced quota. The administrator storage page lists
  no per-user rows.
- **Pressure notice on the shared disk.** Without limits the 90 % warning
  and the "full" state follow the shared filesystem, worded as "Palvelimen
  levy", since a full disk stops everyone.
- **Gateway default limit left alone.** Without quotas apply neither sets
  nor clears the gateway's administrative default; the broker ignores a
  default the gateway still sends.
