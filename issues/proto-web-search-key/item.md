---
created: 2026-11-10
updated: 2026-11-11
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
