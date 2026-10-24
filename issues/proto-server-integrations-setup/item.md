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
