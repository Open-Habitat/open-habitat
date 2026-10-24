# Result: Microsoft 365 single-tenant setup in Integraatiot

Microsoft 365's *Aseta tunnukset…* in Asetukset › Palvelimen ylläpito ›
Integraatiot is round 4's direction 1, "Tunnukset lopussa": *Rekisteröi
sovellus* (a direct link to the Entra admin center's App registrations, the
advice to use Entra's search field, Single tenant only, the Application
Developer role), *Julkinen asiakas* (Allow public client flows, the native
redirect URI, no client secret), *Käyttöoikeudet* (the ten delegated Graph
permissions as one copyable block), *Hyväksyntä* (Grant admin consent, the
roles that may, and a template consent link for whoever holds one), then
Application (client) ID and Directory (tenant) ID and *Tallenna*. *Minulla on
jo sovellus* jumps to the ids. There is no secret, so the row's *Tunnukset*
menu offers only *Poista tunnukset…*, whose dialog adds that another app can
be set after removal.

Single tenant everywhere: `integrationapps.Usable` and `Valid`, the native
MSAL adapter and the browser accept only a GUID tenant; `common`,
`organizations`, `consumers`, empty and domains are refused, and the client id
pasted as the tenant is refused in any case. The daemon no longer defaults an
empty tenant to `common` nor switches personal OneDrive accounts to
`consumers`; every native refresh (rclone, the MCP server) uses the tenant,
and the admin-consent link goes to `/<tenant>/v2.0/adminconsent`. The
operator guide's *Microsoft app registration* section, the CLI help, the
contract description and ADR 0026's catalog rows say single tenant.

## Evidence

- Go: `go test ./internal/integrationapps ./internal/provision ./internal/cli
  ./internal/daemon/integrations ./internal/host ./internal/gateway
  ./test/browser-host`. New: broker `TestIntegrationMicrosoftSingleTenant`
  (audience keywords, domain, missing/empty tenant, client twice in another
  case, non-GUID client, extra secret: refused both encoded and at the
  writer with the file untouched; a GUID pair written and listed; a
  hand-written `common` listed as not usable), daemon
  `TestMicrosoftNativeRefreshUsesTheTenant` and
  `TestMicrosoftAudienceKeywordIsNotConfigured`, the consent link anchored at
  the tenant, validator cases.
- Native runtime: `microsoft-native.test.mjs` (now also refusing the three
  audiences) and `TestMicrosoftSingleGrantNativeRuntime` against a disposable
  copy of a built integrations runtime with the same lockfile and pinned
  rclone 1.71.2.
- Web: `ServerIntegrations.test.tsx` (Microsoft's five steps, field errors for
  audiences, a domain and the same id, a refusal keeping what was typed, the
  skip, the remove-only menu), `./scripts/test-focused.sh --area web`; stories
  `Settings/Palvelimen integraatiot` MicrosoftSet and MicrosoftStep*
  (each step and phone); browser spec `server-integrations.spec.ts` set →
  Käytössä → remove with the administrator's catalog following, axe and
  390 px on the consent step; contracts check.
- Review: focused self-review plus one targeted finder (gpt-6-astra) on the
  validation path: no findings.

Not covered: a real Entra tenant, the deep link opening the right blade, and
a live person connecting through a browser-set single-tenant app.

## Decisions for later review

1. **The daemon also refuses audience keywords**, not only the broker: an
   operator's hand-written `common` app now reads as not configured (the row
   shows *Ei käytössä*, and *Aseta tunnukset…* replaces the section). A single-tenant
   app cannot sign in through `common` anyway, and personal accounts are out.
   If the test server's Fleetrepo-written Microsoft section still says
   `common`, Microsoft is unavailable there until it is set again.
2. **The Entra link opens App registrations**
   (`entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade`),
   not the New registration blade directly: the list blade is the more stable
   address, *New registration* is one click from it, and the search advice
   covers a changed blade path.
3. **The consent link in Hyväksyntä is a template** with
   `{Directory (tenant) ID}` and `{Application (client) ID}` and no copy
   button: the ids are entered only in the last step (direction 1). The v1
   `/{tenant}/adminconsent?client_id=` form grants the permissions configured
   on the registration.
4. **The redirect URI stays `…/common/oauth2/nativeclient`**: it is the
   literal platform redirect Entra suggests, independent of the audience, and
   the daemon's consent link names it.
5. **Client id and tenant id are compared case-insensitively** in the browser
   and the broker (GUIDs are case-insensitive); the same rule now applies to
   Google and Dropbox pairs, where a case-only difference is no real pair.
6. **No new ADR or AGENTS.md rule**: the decision is Jari's in
   `proto-server-integrations-setup` round 4 and the code carries it.
