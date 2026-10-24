---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
preparation: ready
lane: unlaned
collision: [internal/daemon/integrations]
closed: 2026-10-24
---

# Test server: Microsoft 365 'Ei käytössä' after single-tenant change; old setup form shown

## Description

Jari, 2026-10-24 ~15.01, test server around 0.0.0-pilot.379/380: he has a connected Microsoft 365 account (tailspin.test), but Asetukset › Palvelimen ylläpito › Integraatiot shows Microsoft 365 as **Ei käytössä**, and *Aseta tunnukset…* opens the plain fallback form ("Arvot löytyvät palvelusta Microsoft Entra.", Application (client) ID, "Kirjautujat (tenant)" with hint "organizations, common, consumers tai Directory (tenant) ID") instead of the guided single-tenant setup that `server-integrations-microsoft` landed in pilot.380.

Likely causes to confirm with evidence: (a) his browser still ran the pilot.379 bundle (the fallback form is 379's), and (b) pilot.380 made Microsoft single-tenant only, and the test server's existing Microsoft app section (written by Fleetrepo) uses `common`/`organizations`, which is now invalid → provider unavailable, with no explanation on the row; existing connected accounts may also be affected.

Goal: (1) the live cause, (2) an existing invalid app section is shown on the admin row as a concrete reason ("Tunnukset eivät kelpaa: …") with *Aseta tunnukset…* leading to the guided setup, and the person's connected account card says what happened instead of silently breaking; (3) the test server's Microsoft integration works again: the correct path is that Jari enters his app's Application ID and Directory (tenant) ID through the guide — describe exactly what he must enter and whether his connected account then needs to sign in again; if Fleetrepo's test-site configuration writes a multi-tenant section that will keep overwriting the browser-set one, propose the exact Fleetrepo change in spinoff_proposals.

## Acceptance Criteria

- [ ] Live cause in result.md (bundle version served/seen, the app section's tenant value — not secrets, the daemon's availability reason).
- [ ] Invalid existing section shown with a reason on admin row and person card (tests).
- [ ] Clear instructions for Jari in the run summary.
