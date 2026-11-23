---
created: 2026-11-10
updated: 2026-11-23
type: feature
reporter: jari
status: open
priority: normal
related: ['@pi-web-search-capability']
preparation: pending
lane: web-search-key
lane_seq: 1
---

# Design and prototype: search key in Settings › AI and the site key

## Description

Jari 10.11.2026: key-based web search for providers without native search,
Brave by default (Staan as the EU option once coverage is verified). The key
lives in the person's own native Pi config; an administrator may give a site
key copied to people's native config like the AI and speech keys (ADR 0030
pattern), a personal key taking precedence. Keyless third-party fallbacks
stay off. Settings › AI gets a search row: this is an interface change, so
it starts as a prototype round (Settings › AI search row and the
administrator's site-key setting), then implementation.

## Decisions

### 2026-11-11T05:33:25Z · @jari

Jari 11.11.: before choosing the Settings › AI direction, design how the search key works on the server side (administrator's site key, gateway, copy to people's native config, precedence, removal). Next step is that architecture sketch, then the UI.

### 2026-11-23T13:53:36Z · @jari

Jari 23.11.2026 on round 1: back to prototyping. The search key is first of all a server-level setting and should work the same way as the Soniox (speech) key: the administrator's site key copied to each person's native config (ADR 0030 pattern, `SpeechKeyAdministration`, `GiveSiteKey`), with the person's view following the speech key's. Consider whether the person's row belongs under Asetukset › Tiedot agenteille rather than Asetukset › Tekoäly. Round 1's three Tekoäly-page directions are not chosen.
Next action (approved): prototype round 2 from that logic (administrator's site key first, then the person's view and its place).

### 2026-11-23T14:22:44Z · @jari

Jari 23.11.2026 on round 2: B (administrator: server Integrations; person: Tiedot agenteille). But the search key block is far bigger than the other, smaller rows there and looks odd. Ideas: Brave and Staan each as their own row like the other services, or prototype the whole view together so the search key sits in proportion. Next action (approved): prototype round 3 on the whole views with B.
