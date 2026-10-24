# Result: existing Microsoft accounts follow the server's tenant

## What changed

An account's native configs (its rclone remotes' `tenant` and the Pi MCP
registration's `MS365_MCP_TENANT_ID`) now follow the operator's current
Microsoft app. `internal/daemon/integrations/microsoft_tenant_linux.go`:

- **Detection, files only.** `Misaligned` compares the remotes' `client_id`
  and `tenant` and the Pi registration's env with the current app.
- **When.** At daemon start (`Catalog.Start` → `alignAll`, background) and on
  every account check (`check`, under `c.write.TryLock`, so a busy catalog
  leaves it to the next check). The Integraatiot page's *Tarkista* is such a
  check.
- **Files side.** The newest stored refresh token is redeemed at
  `https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token`. Only when the
  tenant accepts it is the account's sync client stopped and every remote's
  `tenant` and `token` rewritten (the refreshed grant), atomically, 0600;
  then sync restarts.
- **Outlook side.** The Pi registration is replaced (`pi mcp add`, the same
  helper Commit now uses) with the current environment. With remotes, their
  grant the tenant accepted decides it; a mail-only account asks the Outlook
  tool (`--verify-login`) through the new tenant first.
- **Refusals.** Another client id (`app_changed`), a grant the tenant refused
  (`tenant_changed`), or an account not in the tenant's directory, AADSTS
  50020/50034/90072 (`outside_tenant`) leave the configs untouched. Every
  service of the account reads `login_expired` with that reason. The reason
  is kept in the daemon's memory per account and app, so it is not asked
  again until the app changes, a sign-in writes the current app, or the
  daemon restarts. An outage or `temporarily_unavailable` decides nothing and
  is retried.
- **Card.** Asetukset › Integraatiot shows the reason once per account
  (`integration-account-alignment`) and offers *Kirjaudu uudelleen* except
  for `outside_tenant`. Story `Settings/Integraatiot` TenantRefused.
- **Contract.** `integrations.schema.json` service `failure` gains the three
  values, described for `login_expired`.

Everything runs in the person's daemon, as the person, on their own files and
their own grant; the only network peer is the tenant's token endpoint built
from the validated GUID. No token reaches a log.

## Evidence

- Go: `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`
  passed. New `microsoft_tenant_linux_test.go`: an account written with
  `common` (with a blank line inside each section) is rewritten to the GUID
  tenant after the fake tenant endpoint accepts its refresh grant, both
  remotes get the refreshed token, Pi is re-registered with the tenant, the
  sync client is restarted, and a second check asks nothing; daemon start does
  the same unprompted; expired grant, other directory and another app show
  their reason, keep the configs byte-for-byte, are not asked again, and a new
  sign-in clears them; an offline and a 503 tenant are retried and nothing is
  written. Mutations (refresh via `common`, no stop, no start hook, code
  50020 unrecognised, blank-line handling) each fail a test.
- Contracts: `./scripts/test-focused.sh --area contracts` passed after
  `go generate ./internal/contracts`.
- Web: `./scripts/test-focused.sh --area web` passed; new
  `Integrations.test.tsx` case (the reason once per card, sign-in offered or
  not). Browser: `integrations.spec.ts` 6 passed; the whole suite once,
  364 passed, 3 skipped.
- Review: focused self-review (found that a JSON `temporarily_unavailable`
  would have been cached as a refusal; fixed) plus one targeted finder,
  gpt-6-astra, on the credential rewrite. Two findings, both confirmed and
  fixed: a blank line inside an rclone section ended it in the rewrite, and
  the pinned `@softeria/ms-365-mcp-server` 0.170.1 reports a refused and an
  unreachable MSAL refresh with the same "Silent token acquisition failed"
  text. The model-performance log entry could not be written (SSH from alder
  to itself refused).

Not covered: a real Entra tenant and real rclone/MSAL refreshes against it.

## Decisions for later review

1. **The check rewrites native files.** The list endpoint otherwise writes
   nothing of the host's; an account's state is only true after its config
   follows the current app, and *Tarkista* is the person's way to ask.
   Alternative: only at daemon start, which would leave a running daemon on
   `common` until restart after the administrator sets the tenant.
2. **Redeem first, then write.** The daemon refreshes once at the new tenant
   instead of rewriting the text and letting rclone fail later; that gives a
   concrete reason and never replaces a working config with one the tenant
   refuses. The refreshed token replaces every remote's (as a sign-in does).
3. **A refused account's configs stay as they are** (still `common`). While
   the Entra registration is multi-tenant, sync may keep working through
   them even though the card asks for a new sign-in; once single-tenant, they
   fail on their own. Stopping sync on refusal was rejected as destroying
   working state for a transitional case.
4. **The refusal is remembered in memory only** (per account and app), not
   written anywhere; a daemon restart asks the tenant once more.
5. **`outside_tenant` hides *Kirjaudu uudelleen*:** a sign-in for the same
   address cannot succeed in that tenant. The card still offers removal.
6. **Mail-only accounts:** the Outlook tool's verify cannot tell a refusal
   from an outage, so such an account is re-registered only after a
   successful verify and otherwise retried; a refused MSAL grant there shows
   as unreachable, as Check already did. Filed as `nominally-overrated-earthquake`.
7. **`invalid_client` (e.g. AADSTS700016, the app not found in the tenant)**
   reads `tenant_changed`, though it is an administrator mistake rather than
   the person's; the administrator's row cannot tell it from a valid GUID.
