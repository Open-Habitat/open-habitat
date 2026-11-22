---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-account-menu
lane: general-feedback
lane_seq: 2
preparation: ready
closed: 2026-11-22
---

# Prototype: the account menu (order, icons, explain, general feedback, phone)

## Description

Jari (22.11.2026, account menu screenshot): the order is odd — 'Selitä tämä näkymä' sits between Asetukset and Palvelimen ylläpito; Explain mode has an icon and it should be in front of the item. Prototype the account menu now (with the general feedback entry from general-feedback-entry, and the phone).

## Decisions

### 2026-11-22T16:21:50Z · @jari

Jari 22.11.2026 on round 1: A Ryhmät (desktop). No visible group headings (separators only). Phone: prototype sheet vs today's popover (account-menu-phone). Not answered, so A's defaults stand: quick rows in today's order (Teema, Agentin työ, Äänet); Palvelimen ylläpito beside Asetukset. Implementation: account-menu-impl, after explain-f-hint-impl lands (it provides the reusable general feedback panel).
