# Result: connection name, immutable pin, migration, no tenant-following

## What changed

- **Connection name.** A Microsoft connection is `<address>~<tenant GUID>`
  (lowercase) on disk and in the daemon: the MSAL cache and its pending and
  rollback stores, the rclone config, bisync listings, first-sync backups,
  the kept first-pass refusal, the Pi entries' `--account`, the daemon's
  Microsoft endpoint binding and the catalog key. Synced directories and
  `~/cloud/microsoft-fetched/<address>/` stay by address. The browser
  contract still addresses a connection by its address; the catalog maps it
  to the name, and keeps one connection per address until step 2 adds
  `tenant_id` to the contract (a second tenant for the same address is
  refused with `already_connected`).
- **Identity pin.** The adapter's import no longer compares MSAL's username:
  it answers the tenant, the tenant-local object id and the `homeAccountId`.
  The daemon requires the tenant to be the chosen one and the object id to be
  Graph `/me`'s `id`, writes `MS365_MCP_EXPECTED_HOME_ACCOUNT_ID` (no
  username) into new entries, checks `--list-accounts` by that id, and a
  renewal must be the pinned `homeAccountId`; a new sign-in to an existing
  name that is another account is `already_connected`. A connection from
  before keeps its username pin until its next sign-in, where it is compared
  by address once and gains the immutable pin. The label falls back from the
  UPN to mail to the id token's `preferred_username`, so a guest-shaped
  account connects. Verification finds the account by the pin in the
  connection's tenant and refuses a store holding two accounts.
- **Migration.** At daemon start (only while no daemon serves the Microsoft
  endpoint, so no previous daemon's child holds a cache) each connection
  from before names is renamed: tenant from its Pi entries and rclone
  remotes (they must agree), every store renamed without replacement in a
  fixed order with stale bisync locks re-pointed before the config moves,
  then the Pi entries rewritten in one write keeping their `ms…` names,
  grant and pin. One a still-running pass holds is renamed by the next
  check through Align, with its sync stopped and the Microsoft slot paused.
  A conversation started before the upgrade still reaches the connection
  through its relay naming the bare address. A bare address whose tenant
  cannot be read, or whose two sources disagree, is left as it is: its
  tools do not bind, its grant is not verified, its card asks for a sign-in
  (`app_changed`), and the sign-in from that card replaces it and removes the
  leftover.
- **No tenant-following.** `redeemAtTenant` and `tenant_changed` are gone. A
  connection's application is the cell of its name's tenant with the client
  id its entries name; another client id there is `app_changed`; no
  application at its tenant (or none at all) is `tenant_removed`, its tools
  are refused at the next call, a renewal or level change never signs in at
  another tenant, and adding the tenant back resumes it. A verification's
  `outside_tenant` is now shown on the card.
- Contract: `tenant_removed` replaces `tenant_changed` in the service failure
  enum; the web has its type, texts and the rule that it offers no sign-in.
  `internal/AGENTS.md` states the name, the immutable pin, GUID-only
  authorities and no tenant-following; `docs/operations.md` and `TESTING.md`
  follow.

## How the migration was verified

- `TestMicrosoftNameMigrationAtUpgrade`: a pre-names home with every store
  (cache, pending, rollback, rclone config with OneDrive syncing, listings
  with a stale lock, backups, kept refusal, Pi entries) is renamed with every
  file's bytes unchanged, the synced file untouched, `SyncCommand` without
  `--resync`, the directory still `~/cloud/onedrive/<address>`, the lock
  re-pointed, the username pin kept, entries still `ms-*`, the bare relay
  binding resolving to the name, and a second run changing nothing.
- `TestMicrosoftNameMigrationFinishesAnInterruptedRun`: an interruption after
  each of the seven renames and before the entry rewrite is finished by the
  next check to the same files as an uninterrupted run.
- `TestMicrosoftNameMigrationLeavesAnUnreadableTenant` (no tenant, and
  disagreeing tenants), `TestMicrosoftNameMigrationWaitsForARunningPass`,
  `TestMicrosoftCatalogRenewalReplacesAnUnresolvedConnection` (old sync
  stopped before Commit; a cancel after Commit keeps the new connection;
  fails on the code before the review fix),
  `TestMicrosoftConfigWithATokenPerRootMigratesAtStart` (name migration then
  the earlier token-per-root migration through `Start`).
- Identity: `TestMicrosoftSignInPinsImmutableIdentity` (pin written, verify
  request carries it, tenant and object-id mismatches refused, guest with
  and without mail), `TestMicrosoftRenewalComparesThePin`,
  `TestMicrosoftUsernamePinnedConnectionGainsTheImmutablePin`,
  `TestMicrosoftOneConnectionPerAddressUntilOrganisationsAreNamed`,
  `TestMicrosoftTenantChangeMovesNothingAndReportsTenantRemoved`.
- Adapter: `microsoft-native.test.mjs` against a disposable copy of the
  pinned runtime (msal-node 5.6.0, ms-365-mcp-server 0.170.1): import answers
  the ids, another tenant refused, guest import, the pinned server's
  `AuthManager` refreshing under `expectedHomeAccountId`, a second account in
  one store refused. `TestMicrosoftSingleGrantNativeRuntime` and
  `TestMicrosoftMCPToolsPinnedServer` pass with that runtime; the former was
  already failing before this change (obsolete union-scope check, roots no
  longer written by a sign-in) and was brought up to date.
- Full clean gate passed on the landed code tree (receipt for tree
  7f5c7e1d, commit ea891bd31). Two earlier runs failed only on
  `internal/daemon` hitting Go's 10-minute timeout under `-race` while other
  workers loaded the machine; the same package takes about 476 s both before
  and after this change when run alone.
- Independent review (gpt-6-astra finder, claude-fable-5-2 verifier, critical
  rigor): four confirmed findings, all fixed in ea891bd31.

## What only real accounts can show

From the design's section 7, for this step: that MSAL's `localAccountId`
equals Graph `/me`'s `id` and the cache holds one account for real accounts
(including a guest), that the pinned server starts and refreshes with the
home-account pin and the tenant as authority after an hour and after a daemon
restart, and the migration on an installation with existing connections,
including one with synced libraries.

## Decisions for later review

- The Pi entries' description still names only the address; the
  organisation's label waits for the allowed list (step 2).
- One connection per address until the contract carries `tenant_id`: a
  sign-in of the same address at another tenant is `already_connected`.
- A level change keeps the connection's tenant, so with sections at
  different tenants a level whose application is elsewhere is refused
  rather than moving the connection.
- An unresolved bare connection shows `app_changed` ("sign in again"); its
  renewal without an explicit level uses the broadest configured level, and
  the replacement does not carry over roots it was syncing (files stay).
- The adapter now also filters a username-pinned account by tenant: a legacy
  cache whose MSAL account sits in another tenant than its name fails closed
  (asks for a sign-in).
- Three review findings were rated RARE (unresolved bare connections,
  bare-to-named renewal bookkeeping, start-up rename beside a previous
  daemon) and were fixed anyway, as identity and credential-loss boundaries;
  their fixes can be reverted if judged not worth the code.
- Adapter and daemon ship together in a release; a daemon talking to an
  adapter of the previous wire shape refuses the sign-in (`tool_failed`).
