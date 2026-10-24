---
created: 2026-10-24
updated: 2026-10-24
type: feature
status: open
priority: normal
preparation: ready
lane: site-admission
lane_seq: 4
collision: [internal/provision, web/src/app/Settings, contracts/v1/]
blocked_by: ['@server-integrations-admin']
---

# Administration Integraatiot: Microsoft 365 single-tenant setup

## Description

Implement the Microsoft 365 app setup in the administration Integraatiot tab as Jari chose in `proto-server-integrations-setup` round 4 (Decisions 2026-10-24; spec `design-system/prototypes/rounds/` round 4 and result.md "Kierros 4"), on top of `server-integrations-admin` (tab, broker write path, Google setup).

- Vaiheittain, direction "Tunnukset lopussa": Rekisteröi sovellus, Julkinen asiakas, Käyttöoikeudet, Hyväksyntä, then Application (client) ID and Directory (tenant) ID and *Tallenna*.
- A direct link to the Microsoft Entra admin center where the registration is made, and the advice to use Entra's search field to reach the right page.
- Single tenant only: the broker stores the tenant GUID (never `common`); browser and broker validate as `microsoftApp()` does, client id ≠ tenant id. Personal Microsoft accounts are out: update `docs/operations.md`'s Microsoft app registration section and any code/text assuming `common`/consumers; check `microsoftConsent()` uses the same tenant for the admin-consent link.
- No secret; the row's *Tunnukset* menu offers only *Poista tunnukset…*.
- Admin consent step is part of the guide.

## Acceptance Criteria

- [ ] Stories for each step and the saved row; browser spec set → Käytössä → remove; broker validation tests for tenant/client ids; docs updated.
- [ ] KOKEILTAVAA.md line. Review: focused self-review plus one targeted reviewer (credential validation path).
