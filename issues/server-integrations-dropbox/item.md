---
created: 2026-10-24
updated: 2026-10-24
type: feature
status: done
priority: normal
preparation: ready
lane: site-admission
lane_seq: 5
collision: [internal/provision, web/src/app/Settings, contracts/v1/]
blocked_by: ['@server-integrations-microsoft']
closed: 2026-10-24
---

# Administration Integraatiot: Dropbox app setup

## Description

Implement the Dropbox app setup in the administration Integraatiot tab as Jari chose in `proto-server-integrations-setup` round 5 (Decisions 2026-10-24; round 5 source in `design-system/prototypes/rounds/` and result.md "Kierros 5"), on top of `server-integrations-admin`.

- Vaiheittain "Sivu kerrallaan": Luo sovellus (direct App Console link; Scoped access, Full Dropbox; create it on the organisation's shared Dropbox account), Asetukset (redirect `http://localhost:53682/`, Enable additional users), Käyttöoikeudet (the seven scopes from `dropboxScopes`), Tunnukset (App key, App secret) and *Tallenna*.
- Row *Tunnukset* menu: only *Poista tunnukset…*, plus the 50-user Development-status note.
- Broker validation as `dropboxApp()`, key ≠ secret; only the App key returns to the browser.

## Acceptance Criteria

- [x] Stories for each step and the saved row; browser spec set → Käytössä → remove; broker validation tests.
- [x] KOKEILTAVAA.md line. Review: focused self-review plus one targeted reviewer (credential validation path).
