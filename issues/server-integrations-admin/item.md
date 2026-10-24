---
created: 2026-10-24
updated: 2026-10-24
type: feature
status: open
priority: normal
preparation: ready
lane: site-admission
lane_seq: 3
collision: [internal/provision, internal/gateway/administration, contracts/v1/, web/src/app/Settings]
---

# Administration Integraatiot tab, Google setup and broker-written app credentials

## Description

Implement the administration Integraatiot tab and the Google app-credential setup that Jari chose in `proto-server-integrations-setup` (rounds 1–3 and its Decisions, 2026-10-24). Microsoft and Dropbox setups follow their own prototype rounds; until then their rows offer the same plain client id/secret (Microsoft: app id + sign-in audience) entry without a guide.

Authority (Jari 2026-10-24, option B of round 1's authority note): the root broker writes the app-credential sections of `/opt/open-habitat/integrations.json` on the gateway's request, the ADR 0030 pattern.
- Broker gateway-socket operations `set_integration_app {provider, fields, actor}` and `clear_integration_app {provider, actor}`; strict validation identical to the daemon's `parseConfig` and the provider's own format rules; replaces only that provider's section atomically under the same lock `host apply` uses for `tools`; preserves every other byte; root ownership/mode as today (`core.ReadOperatorFile` keeps trusting it). Read-only list returns provider, client id (not secret; Google shows the project-number prefix, not the `.com` suffix), actor and time. Secrets never return to the gateway or browser and are never logged.
- site.json `integrations.browser_setup` (default true; root can set false, then the broker refuses writes); `host plan` and `open-habitat admin integrations list` show actor and time. CLI `admin integrations list|set|clear` (secret from stdin) per the CLI canon, CONFORMANCE.md rows.
- Gateway: administrator check, request relay, pending/confirmed/uncertain states like `runtime-admission-broker`.
- Record the authority rule in internal/AGENTS.md (and update ADR 0030 or add ADR text as the repository's decision practice requires).

UI:
- Settings › Palvelimen ylläpito › Integraatiot, round 2 direction 2 "Käytössä vai ei" with round 1 removals: title and six rows in catalog order; status *Käytössä* / *Ei käytössä* / *Ei käytössä · <tool> puuttuu*; *Käyttöönotossa* / *Käyttöönotossa · piilossa* badge only where a step exists, linking to Käyttöönotto; *Aseta tunnukset…* on the row; *Vaihda* / *Poista* under a *Tunnukset* menu; *Korjaa…* dialog with one copyable command for a missing tool.
- Google setup: round 3 direction 2 "Vaiheittain" (one step at a time, progress, Takaisin/Seuraava, *Minulla on jo asiakas* shortcut). Internal only: no External option, state that Internal requires Google Workspace. Replace = new secret for the same client only. English console wording as in Google's docs. Content from `google_linux.go` (APIs, scopes, Desktop app client, no redirect URI).
- Removal confirmation lists round 2's three consequences. Onboarding rules from round 1 (step hidden while not ready) apply through `onboarding-integration-steps`.

Spec sources: `design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-{1,2,3}/`, `issues/proto-server-integrations-setup/result.md`.

## Acceptance Criteria

- [ ] Broker tests: validation, byte preservation of other sections and `tools`, lock shared with host apply, switch off refuses, secrets never returned or logged; a gateway test for the admin check.
- [ ] VM or distinct-UID test: a set credential makes the provider Available for a second real user's daemon.
- [ ] UI: stories for every row state, the Google steps, browser spec set → Käytössä → remove, phone layout.
- [ ] KOKEILTAVAA.md line. Review: independent `/llm-review` at high-risk level + `/assess-findings` (root write path, secrets, authority).
