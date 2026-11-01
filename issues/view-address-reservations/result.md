# Result: one bounded address reservation per view

Implemented together with `view-address-publication-lifecycle`: the store, its
wire interface and every caller change in one landed change, because the new
reservation API replaces the movable-link API the old card and Settings used.

## What landed

- `internal/gateway/view_links_linux.go`: `view-links.json` format 2. One
  reservation per owner and frozen view ID (ID, independent 256-bit entry and
  content secrets, owner route, view ID, title, created, public-until). Lazy,
  CSRF-protected `POST /api/v1/view-addresses` ensure: an existing reservation
  is answered without a daemon call; a new one is verified through the owner's
  daemon, the session is rechecked, and uniqueness is enforced under the lock
  (concurrent ensures agree). Reservations start private and survive restart
  and expiry. Separate caps: 1000 reservations per person, 8192 per site;
  at the cap `view_addresses_limited`, never eviction.
- An unusable store (version 1, invalid, loosened or removed while holding
  addresses) disables address reads and writes with the fixed diagnostic
  `view_address_store_unavailable` (reason `legacy_view_link_store` or
  `invalid_view_address_store`) and is never rewritten; the rest of the app
  answers. Writes stay private atomic (0600 temp, fsync, rename, dir fsync).
- One-time legacy reset: `open-habitat upgrade-view-addresses` (gateway
  `ResetLegacyViewLinks`), run by `host upgrade`'s activate step as the gateway
  account before the gateway starts. Version 1 → empty version 2; current,
  absent and unusable stores are left as they are. The upgrade plan announces
  `upgrade.view_addresses / old_share_links_stop_working` when a version-1
  store is present.
- Contract `contracts/v1/view-address.schema.json` (replaces
  `view-link.schema.json`), examples, negative checks, generated types, web
  validator.

## Tests

`go test -race ./internal/gateway ./internal/host`; contracts focused check;
web focused check (1188 tests); browser `view-links.spec.ts`. New gateway tests
cover privacy of new reservations, idempotent and concurrent ensure, restart of
private/expired reservations, loosened/corrupt/legacy store handling, reset
outcomes, delete-last-then-reload, caps, session-ended writes.

## Decisions for later review

- **Store file and upgrade hook.** Kept the file name `view-links.json` with
  format version 2, so the transition is one atomic rename. The reset runs as
  the gateway account through a fixed argv entry in `cmd/open-habitat`, so the
  gateway package alone owns its format; root only invokes it. Alternative: a
  new file name (two files to reconcile) or root editing gateway state
  (crosses the rule that gateway state is the gateway's).
- **The test server is not upgraded by `host upgrade`.** Fleetrepo's
  `release_fresh_next.py` installs releases there, so it does not run the
  reset. A test server with an old `view-links.json` will log
  `legacy_view_link_store` and show no sharing until someone runs
  `sudo -u open-habitat-gateway /opt/open-habitat/current/open-habitat upgrade-view-addresses`
  with the gateway stopped (or deletes the disposable file). Fleetrepo's release
  closure should gain that step; noted for the conductor.
- **Caps.** 1000 reservations per person, 8192 per site, store limit 32 MiB.
  Each own-tab open will reserve once unit 3 lands; 1000 leaves room for
  months of heavy agent use before manual cleanup.
- **Reservations without public sharing.** Reserving, making private and
  deleting work whenever views are enabled, even with `link_max_days` 0
  (the ADR keeps private opens independent of the site switch). The list then
  answers `max_days: 0`.
- **Revocation with an unusable store fails.** Root revocation and withdrawal
  delete reservations permanently; when the store cannot be written they now
  return an error (sessions are still removed and the login fence set) so the
  operator repairs the store and revokes again, rather than logging success
  and letting a repaired store revive the publications.
- **Malformed version-1 stores are reset too.** The reset discards every
  version-1 link by design; only new-format state is protected from recovery.

## Remaining gaps

The entry URL (`/n/<secret>`) is stored and returned but not served until
`view-address-entry-route`; the app answers 404 there and its request
diagnostics have not yet been made secret-free for that path. Real ingress and
two-user evidence belong to `view-address-end-to-end`.
