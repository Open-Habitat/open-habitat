---
created: 2026-10-24
updated: 2026-10-24
type: task
reporter: jari
status: in-progress
priority: normal
preparation: pending
lane: unlaned
---

# Prototype: server admin integrations setup, step by step

## Description

Jari 2026-10-24: creating and entering the integrations' app credentials (Google OAuth client, Microsoft app registration, Dropbox app) belongs in the server admin UI (Settings › Palvelin, or its own tab under "Palvelimen ylläpito"); the installer only provides the tools, and the admin finishes integrations in the browser. Prototype these UI pieces properly, **one step at a time** (method of earlier proto-* rounds; production components; PICKER.md tablet; desktop/390 px, light/dark; Finnish summary with recommendation and questions).

Suggested order: (1) the admin's integrations overview — what is available out of the box (IMAP, CalDAV, CardDAV), what needs app credentials, status per provider; (2) Google: a guided setup for registering the OAuth client in the organisation's Google Cloud project (APIs to enable, consent screen Internal vs External and what verification means, redirect, scopes) and entering client id/secret; (3) Microsoft; (4) Dropbox. Each round after Jari's verdict on the previous one.

Alongside round 1, a short authority note for Jari: today these credentials live in root-owned `/opt/open-habitat/integrations.json` readable by mapped users; a browser admin writing them is an authority change like ADR 0030's site AI key and runtime admission (likely a broker/gateway request path). Options and one recommendation; decided with Jari before implementation.

## Acceptance Criteria

- [ ] Round 1 published (overview) with the authority note; later rounds per Jari's verdicts.

## Decisions

### 2026-10-24T05:37:53Z · @jari

Jari 2026-10-24: integration app credentials are written by the root broker on a browser admin's request (the ADR 0030 pattern), enabled by a site.json flag. Conductor's accompanying safeguards, not objected to: first-time entry directly; replacing or removing an app credential in use is visible to all administrators and logged on the server; the person sees the app's name/owner before connecting.

### 2026-10-24T06:03:20Z · @jari

Jari 2026-10-24, round 1 verdicts: two Integraatiot entries in Settings (the person's own and the administration one) is fine; the onboarding rules are accepted (an integration step shows to new people only while the integration is ready; only a ready integration can be added as a step; removing credentials hides the step without deleting it); option B confirmed (root broker writes Google/Microsoft/Dropbox app credentials on the gateway's request). Not yet answered: placement (own tab / by state / within Palvelin) and whether round 2 starts with Google. The integrations.browser_setup default was not addressed; the recommendation (true, root can lock it) stands unless he says otherwise.

### 2026-10-24T06:12:16Z · @jari

Jari 2026-10-24, round 1 → round 2: placement is direction 1, its own tab (Palvelimen ylläpito › Integraatiot). Remove: the 'Näytä henkilön näkymä' action; the intro paragraph ('Mitkä palvelut henkilöt voivat yhdistää…'); the explanation that the server stores the credentials and the browser only requests; the summary counts row (Valmiina käyttöön 3 / Tarvitsee sovellustunnukset …). Next: riff the Integraatiot tab itself (round 2) before the Google guided setup.

### 2026-10-24T06:27:30Z · @jari

Jari 2026-10-24, round 2 verdicts: direction 2 'Käytössä vai ei'; plain 'Ei käytössä' is enough (no reason suffix); the Käyttöönotossa badge only on rows that have a step is enough. Start round 3: Google guided setup.
