# Result: Microsoft 365 "Ei käytössä" on the test server after the single-tenant change

## Live cause (2026-10-24, read-only on the test guest)

- **Bundle.** The single-tenant release (`2d977884`, containing
  `0f846659`/`08a62aa0`) was installed at 11:57 UTC; the gateway and Jari's
  daemon restarted at 11:58 UTC. Jari looked at 15.01 Finnish time (12.01
  UTC). The served `web/assets` no longer contain the fallback form's
  "Kirjautujat (tenant)" label, so the plain form he saw came from the
  previous release's bundle still running in his open tab (the SPA does not
  reload itself on upgrade). A reload shows the guided setup.
- **App section.** `/opt/open-habitat/integrations.json` (root 0644,
  last written 2026-10-23 04:50 UTC by Fleetrepo's Microsoft runtime operator)
  has `microsoft = {client_id: de851e89-0dc2-4a4a-a22c-afb14c45ca79,
  tenant_id: "common"}`. The single-tenant release refuses `common`.
- **Daemon's reason.** From 12:00:52 UTC Jari's daemon logs
  `integrations_config outcome=ignored entry=microsoft reason=invalid_entry`
  and the catalog reports Microsoft `available=false`,
  `unavailable_reason=app_credentials_required`: the row's *Ei käytössä*.
- **The app itself** (Fleetrepo SOPS record, public fields only): *Open
  Habitat (testi)*, client `de851e89-0dc2-4a4a-a22c-afb14c45ca79`, registered
  in the tailspin.test directory `0352bbfa-bf37-4cc8-b63b-54cdd1d7296f`,
  audience multi-tenant + personal, public client, admin consent granted in
  tailspin.test.
- **Jari's connected account** (one, `*@tailspin.test`): its home rclone
  config was written at sign-in with `tenant = common` and the same client
  id; nothing in it was changed.
- **Fleetrepo does not overwrite.** No timer or release step rewrites the
  section; the Microsoft operator runs only by hand, and on a differing
  section it refuses ("deliberate rotation required") rather than writing.
  Its `verify` however asserts `tenant_id == "common"` and its input check
  accepts only `common`, so after the browser sets a GUID the operator's
  verify fails and a re-run cannot install. That needs a Fleetrepo change
  (proposed to the conductor, not made here).

## What changed

- Asetukset › Palvelimen ylläpito › Integraatiot: a provider row whose
  existing section every daemon ignores (`usable: false`) says *Tunnukset
  eivät kelpaa: …* with the reason read from its public ids — an audience
  keyword (`common`, `organizations`, `consumers`), a missing or malformed
  tenant or client id, or values the browser cannot see. *Aseta tunnukset…*
  opens the guided single-tenant setup and replaces the section.
  `invalidApp` in `web/src/app/serverIntegrations.ts` classifies.
- Asetukset › Integraatiot: a connected account whose provider is out of
  use on the server shows a notice on its card (the server's app settings
  are missing or no longer valid, agents cannot reach it and sync does not
  proceed, the sign-in is kept, ask the administrator; or a missing tool).
  *Kirjaudu uudelleen* stays hidden, as before, while it could not work.
- Stories: `Settings/Palvelimen integraatiot` MicrosoftAudienceKeyword and
  the person's `ProviderOutOfUse`.

## What Jari does on the test server

1. Reload the page (the open tab still runs the old bundle).
2. Asetukset › Palvelimen ylläpito › Integraatiot › Microsoft 365 now says
   *Tunnukset eivät kelpaa: kirjautujiksi on asetettu common…*. Press
   *Aseta tunnukset…* › *Minulla on jo sovellus*, and enter
   - Application (client) ID: `de851e89-0dc2-4a4a-a22c-afb14c45ca79`
   - Directory (tenant) ID: `0352bbfa-bf37-4cc8-b63b-54cdd1d7296f`
   (both from the Overview of *Open Habitat (testi)* in the tailspin.test
   Entra), then *Tallenna*. The row turns *Käytössä*.
3. Nothing needs to change in Entra. The existing registration may stay
   multi-tenant: the product signs in only through the tailspin.test tenant
   either way, and consent was already granted there.
4. The connected tailspin.test account should continue without signing in
   again: the same app issued its refresh token, Outlook now refreshes
   through the tailspin.test tenant, and the files sync still through
   `common`, which the multi-tenant registration accepts. Press *Tarkista*
   on the card; if a service asks to sign in again, *Kirjaudu uudelleen*
   once writes the tenant into the home config too.
5. If he later switches the registration to *Single tenant only* in Entra,
   the files sync's stored `common` stops refreshing (AADSTS50194) and the
   account must sign in again once.

## Evidence

- `./scripts/test-focused.sh --area web` (109 files, 686 tests) passed.
  New: `ServerIntegrations.test.tsx` (an operator `common` section shows the
  reason and *Aseta tunnukset…* opens the guide at its first step; the
  classifier tells audience keywords, a malformed tenant or client id and a
  Google section apart; usable is no reason) and `Integrations.test.tsx`
  (an account under an out-of-use provider has the notice and no sign-in,
  and an available one has no notice).
- Full gate (`ci-local.sh --clean`): two failures in untouched code, both
  passing in isolated reruns: `StartHere.test.tsx` (known,
  `start-here-test-lazy-markdown-flake`) and the Go
  `TestResumeRetriesUnreachableAndNamesItsFailure` (filed as
  `vaguely-murky-snow`). The gate stopped before its browser phase, so the
  touched specs `server-integrations.spec.ts` (3) and `integrations.spec.ts`
  (6, with axe) were run green, and the whole browser suite once (360 passed, 3 skipped).
- Live: read-only metadata, unit state, journal lines and the public fields
  of `integrations.json`; only the `tenant`/`client_id` lines of the home
  rclone config were read. Nothing was changed on the server.

## Decisions for later review

1. **The reason is computed in the browser from the broker's existing list**
   (`usable`, `client_id`, `tenant_id`), not added to the contract. The list
   already carried every public fact; a contract field would repeat the same
   rule in the broker. The alternative is a broker-side `invalid_reason`
   code, worth it only if the CLI needs the same words.
2. **The person's card does not tell "missing" from "invalid"**: the
   person's daemon reports only `app_credentials_required` and a person
   cannot act on the difference; the administrator's row has it.
3. **No migration in the daemon for the home's stale `tenant = common`**:
   it keeps working while the registration is multi-tenant, and a sign-in
   rewrites it. Making the daemon rewrite the rclone tenant from the current
   app is proposed as follow-up, not done here.
4. **The admin row's *Ei käytössä* label is unchanged**; the reason is a
   separate line under the name, like a refused removal.
