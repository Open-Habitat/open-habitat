---
created: 2026-11-22
updated: 2026-11-23
type: improvement
reporter: jari
status: testing
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-account-menu-phone
lane: account-menu-phone
lane_seq: 1
preparation: ready
---

# Prototype: the account menu on the phone (sheet vs popover)

## Description

Jari 22.11.2026: prototype the account menu on the phone: a bottom sheet (round 1's proposal) versus today's popover in the drawer, with direction A's content.

## Decisions

### 2026-11-23T05:43:12Z · @jari

Jari 23.11.2026: could not evaluate round 1 — every phone frame shows 'This content is blocked' when opened as a Habitat view (the round loads phones in iframes, which the view sandbox blocks). Next action: rebuild the round without iframes so it works as a view; then Jari chooses.
