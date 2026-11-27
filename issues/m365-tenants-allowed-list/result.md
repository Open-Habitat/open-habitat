# Result: allowed organisations list, broker, CLI, table, dispatch refusal, contracts

## What changed

- **Configuration.** Root's integrations file takes the four shared
  (multi-tenant) sections `microsoft_shared`, `microsoft_shared_nosend`,
  `microsoft_shared_drafts`, `microsoft_shared_read` (same two fields as the
  single-tenant ones; `tenant_id` is the owning tenant, never an authority on
  its own account) and the allowed list `microsoft_tenants`: tenant GUID to
  label, at most 32, labels 1–64 printable characters. A list the broker would
  refuse is ignored whole by every daemon. The level scopes and the consent
  link now live in `integrationapps`, shared by the daemon and root's CLI.
- **Broker.** `set_integration_tenant` (add or relabel in place) and
  `remove_integration_tenant` change one entry as a read-modify-write of the
  one member, under the host operation lock and the broker lock, with the
  `browser_setup` switch and an actor record per tenant (against the label's
  digest, so a hand edit reads as root's). The last removal takes the member
  away. A list root wrote that the daemons refuse is reported
  (`tenants_invalid`) and never rewritten; a 33rd organisation is
  `integration_tenants_full`. Replies may be up to 32 KiB (only the
  integrations page needs it: eleven sections and 32 organisations with
  escaped labels); requests stay within 4 KiB. The broker's state file bound
  is 16 KiB. `internal/AGENTS.md` names the extended input.
- **Gateway and CLI.** `POST /api/v1/server/integrations/tenants/set|remove`
  and control operations `integration_tenant_set|remove`, after the current
  administrator check; the list carries `tenants`. Root's CLI:
  `admin integrations set --provider microsoft_shared…`,
  `admin integrations tenants list|add|remove` (with `--dry-run`) and
  `admin integrations consent-link --tenant-id`, which computes each
  configured shared level's admin-consent link for one organisation and
  writes nothing.
- **Daemon table.** Applications form a table by organisation and level,
  read from root's file at every use: single-tenant sections fill their own
  cell, then each listed organisation gets the shared application at every
  level still empty. Organisations are ordered own first (the shared
  applications' owner, or with none the single-tenant sections' tenants),
  then the list's order, then unlisted single-tenant tenants. Nothing falls
  back to another organisation.
- **Connect and addressing.** A login start may name `tenant_id`; one the
  file does not serve at the level is `409 organisation_unavailable` before
  any request to Microsoft. Without it a new connection signs in at the first
  organisation with the level, so a single-organisation installation behaves
  as before. Step 1's `already_connected` limit is lifted: one address can be
  connected in several organisations, each its own name, stores and entry
  prefix. Accounts, removals, change replies, file roots and login views
  carry `tenant_id` (accounts also `organisation`, the label); an address
  connected in several named without `tenant_id` is `409
  organisation_required`. The agent CLI passes `tenant_id` through.
- **Dispatch refusal.** Removing an organisation from the list removes its
  cells, so `microsoftBinding` refuses its tools at the next call, its card
  shows `tenant_removed`, a renewal is refused, and (review fix) reconcile
  and the interrupted-pass resume no longer run its rclone sync and a check
  stops a running one. Stores and entries stay; adding it back resumes it.
- **Agents.** Entry descriptions and the skill heading name the organisation
  label when it has one (`person@own.example (Client One)`); an unlabelled
  connection keeps today's text, so nothing is rewritten on a
  single-organisation installation. A relabel rewrites the entries at the
  next check.
- **Refusals.** AADSTS 50020, 50034 and 90072 are `not_in_organisation`.
- **Contracts.** `server-integrations` (shared sections, `tenants`,
  `tenants_invalid`, the two tenant requests), `integrations` (provider
  `organisations`, account `tenant_id` and `organisation`),
  `integration-login-control` (`tenant_id`), `integration-login`
  (`tenant_id`, `not_in_organisation`), `integration-account`,
  `integration-change`, `integration-files` (`tenant_id`). Generated Go and TS
  follow; the browser's list reader takes the 32 KiB reply.
- **Words.** `internal/AGENTS.md`, the operations guide (new section
  "Microsoft 365 for several organisations", with the limitation stated as
  the design has it), the operator skill and `CONFORMANCE.md` say that the
  list is not a security boundary and what removal does.

## How the migration was verified

This step adds no migration: existing files keep their bytes and meaning,
and an installation with only single-tenant sections builds a one-organisation
table that signs in exactly where it did.

- `TestMicrosoftSingleOrganisationUnchanged`: default sign-in at the
  section's tenant and client, entry description and skill label unchanged,
  no Align triggered, address-only addressing still works.
- `TestMicrosoftOrganisationTable`: single-tenant sections only (one and two
  tenants, root's case kept as the authority), shared plus list (own first
  regardless of list order, own single-tenant section kept, shared fills the
  rest, a missing shared level), owner not listed, the operator's file (a
  broken list refused whole).
- `TestMicrosoftSameAddressInSeveralOrganisations`: one address in three
  organisations gives three names, caches and entry prefixes, each at its own
  authority and client id, none overwritten; the list shows `tenant_id` and
  `organisation`; address-only removal and renewal are
  `organisation_required`; removal by `tenant_id` removes only that one.
- `TestMicrosoftUnlistedOrganisationIsRefused`: unlisted organisation and a
  level the organisation lacks are `organisation_unavailable` with no request
  sent; an audience keyword or domain is 400.
- `TestMicrosoftRemovedOrganisationStopsAndResumes` and
  `TestMicrosoftRemovedOrganisationStopsItsSync` (fails without the review
  fix): removal stops binding, renewal and sync, keeps the stored sign-in, and
  adding back resumes.
- `TestMicrosoftAnotherOrganisationIsAnotherConnection` replaces step 1's
  one-connection-per-address test; `TestMicrosoftNotInOrganisation`.
- Root side: `TestTenantListIsGUIDsAndLabels`,
  `TestSharedSectionsAreMicrosoftLevels`,
  `TestIntegrationTenantListAddRelabelRemove` (every other byte kept, last
  removal restores the file), `TestIntegrationTenantListBound` (33rd refused;
  a full page with `&` labels and every section fits the reply),
  `TestIntegrationTenantListRootMustRepairAnInvalidList`,
  `TestIntegrationTenantRequestValidation`, gateway `TestIntegrationTenantsRelay`,
  CLI `TestAdminIntegrationTenantsCommands`.
- Contracts: examples and negative checks in `scripts/validate-contracts.py`.
- Full clean gate passed on the landed code tree (receipt for tree 41816255, commit ec9f61f16). The first run failed only on web unit fixtures that lacked the now-required `tenants`, fixed in that commit.
- Independent review (gpt-6-astra finder, claude-fable-5-2 verifier, critical
  rigor): two confirmed findings, both fixed in the last commit.

## What only real accounts can show

From design section 7, for this step: that a shared application signs a
member and a B2B guest in at the client tenant's authority (and that the
client's Conditional Access allows device code), which AADSTS code an
organisation that never approved returns, what the admin-consent link shows
a client's administrator with an unverified publisher and that approving one
level leaves the others unapproved, and that removing an organisation and
adding it back behaves the same against live refresh tokens.

## Decisions for later review

- The broker reply bound is 32 KiB (requests stay 4 KiB) rather than a
  paged tenant list: the page needs ~25 KiB at its worst and paging would
  add a second read protocol for one administrator page.
- `own` is the shared applications' owning tenant; with no shared section,
  every single-tenant section's tenant.
- A start without `tenant_id` signs in at the first organisation with the
  level (own first), which keeps today's browser working until step 3. An
  address connected in several organisations needs `tenant_id`
  (`organisation_required`); today's browser sends none, so after a second
  organisation is connected (possible only through the agent CLI until
  step 3) the card's renew and remove buttons for that address refuse.
- `organisations` is listed on the provider even with one organisation; the
  UI decides not to show the step.
- Removing an organisation stops a running legacy sync at the next check or
  reconcile, not at once: the catalog has no timer. Its tools stop at the
  next call.
- Entry descriptions carry the label, so a relabel or removal rewrites the
  entries (Align) at the next check; an unlabelled connection keeps today's
  text.
- The review findings were rated RARE by the assessment rules (DROP 1b) and
  were fixed anyway: the first is the design's own "removal stops
  connections" boundary, the second one constant; both can be reverted.
- `not_in_organisation` has no browser text yet; the generic failure shows
  until step 3.
