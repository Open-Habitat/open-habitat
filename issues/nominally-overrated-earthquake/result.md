# Result: a refused Outlook grant reads as an expired sign-in

## What changed

- **Adapter `verify` mode** (`runtime/profiles/integrations/microsoft-native.mjs`,
  `-cli.mjs`). `microsoft-native verify` reads `{client_id, tenant_id, address}`
  on stdin. The paths come from the same `MS365_MCP_*` environment the tool
  uses. It loads the pinned tool's own `AuthManager` and encrypted store, so its
  cache plugin persists a rotated refresh token exactly as the tool would. It
  then runs MSAL's silent acquisition with `forceRefresh` and answers
  `{"state": ...}`:
  - `outside_tenant`: AADSTS 50020/50034/90072 (`errorNo`);
  - `refused`: `errorCode` invalid_grant, interaction/consent/login_required,
    bad_token, invalid_client, unauthorized_client, access_denied, or MSAL's
    no_tokens_found / refresh_token_expired; also a store that is missing,
    unreadable or lacks the address;
  - `unreachable`: anything else (network, discovery, temporarily_unavailable,
    5xx), or Graph `/me` not answering 2xx, as the tool's own check did;
  - `ok`.
  The error's text is never read, and no token or native text reaches stdout.
- **Daemon** (`internal/daemon/integrations`). `microsoftVerify` replaces the
  `--verify-login` substring matching. `Check` maps refused and outside_tenant
  to `login_expired`, so Mail/Kalenteri/Yhteystiedot offer *Kirjaudu
  uudelleen*. A mail-only account's tenant follow records `tenant_changed` or
  `outside_tenant` instead of retrying a refusal on every check. Anything the
  adapter did not decide is `unreachable` and is asked again.

## Evidence

- Adapter, real pinned MSAL 5.6.0 and ms-365-mcp-server 0.170.1 against
  synthetic Entra (`bin/node microsoft-native.test.mjs` in a disposable runtime
  whose `node_modules` came from the verified profile build):
  - `ok` on a working grant, which is still asked of the tenant while a 1 h
    access token is cached, and the rotation is persisted;
  - Graph 503 and an offline Graph read `unreachable`;
  - invalid_grant, interaction_required and invalid_client read `refused`;
  - 50020 and 90072 read `outside_tenant`;
  - a 503 read `unreachable`, also when its description says login_required;
  - a transport failure reads `unreachable`;
  - another address and a missing store read `refused`; an audience keyword is
    rejected.
  Each of these mutants failed the test: no outside-tenant check, no
  refusal-code list, no Graph check, no forced refresh, a class-based check,
  and a missing account read as unreachable.
- Go: `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`
  passed. The fake tool now answers only `verify`, so a regression to
  `--verify-login` fails. New table cases cover Check, and the new
  `TestMicrosoftMailOnlyAccountFollowsTheTenantByItsOutlookGrant` covers the
  mail-only tenant follow (refused, outside_tenant, unreachable retried, ok
  re-registers). Two mutants failed it.
- `TestMicrosoftSingleGrantNativeRuntime` (with `OH_TEST_MICROSOFT_RUNTIME`,
  rclone 1.71.2) checks that the real adapter accepts the daemon's verify
  request. Changing the argv broke it.
- Review: focused self-review plus one targeted finder, gpt-6-astra, on the
  credential path. It confirmed two findings, both fixed in the second commit:
  - a cached access token answered without asking the tenant, so after a
    tenant change the previous tenant's token read `ok`;
  - MSAL picks `InteractionRequiredAuthError` by matching the description, so
    classifying by class was classifying by text.
  One finding was dropped: the store's lost-update race with a running MCP
  server is the library's own cache plugin, the same as `--verify-login`. A
  lost rotation leaves the previous refresh token in the store, and it stays
  valid.

Not covered: a real Entra tenant. The test server needs a rebuilt
integrations profile (below).

## Deployment

The test server's integrations profile is pinned in Fleetrepo
(`infra/open-habitat-test/GUEST-MICROSOFT-RUNTIME.md`, an archive built from
product `8057ac2d`), not shipped with each release. Until it is rebuilt from
this commit and repinned, the daemon's `verify` reaches the old adapter. That
adapter answers `native_failed`, so every Outlook service reads *Palvelimeen ei
saada yhteyttä*. The repin also carries the single-tenant adapter change
(`0f846659`), which that archive predates.

## Decisions for later review

1. **Verify always refreshes.** Each Check makes one token request instead of
   answering from a cached access token. A cached token proves nothing about a
   revoked grant or a new tenant, and the request is the same one the tool
   makes when its token expires. Alternative: refresh only in the tenant
   follow, which leaves a revoked grant reading *Toimii* for up to an hour.
2. **Graph `/me` stays in the check**, as `--verify-login` had it: a token
   without a reachable mailbox is `unreachable`, not `ok`.
3. **A missing or unreadable store reads `refused`** (sign in again), since only
   a new sign-in rewrites it. Alternative: `unreachable`, which would retry a
   permanently broken store forever.
4. **`outside_tenant` in Check is `login_expired`** like a refusal. The reason
   text comes only from the tenant follow, as before.
