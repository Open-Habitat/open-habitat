---
created: 2026-11-08
updated: 2026-11-08
type: improvement
reporter: jari
status: open
priority: normal
lane: offer-cards-proto
lane_seq: 2
blocked_by: ['@proto-offer-cards-consistent', '@proto-conversation-assets']
preparation: ready
---

# One offer card and a conversation assets list, opening beside

## Description

Implementation of Jari's decisions on `proto-offer-cards-consistent` (rounds
1–3: **1 Kortti**, **A Viereen**, **A Kulma**) and `proto-conversation-assets`
(rounds 1–3: **Siru**, **Oma siru** by the Workers chip, **A Kuvakkeet**),
8.11.2026. The prototypes are the specification:
`design-system/prototypes/rounds/2026-11-08-tarjouskortit-3/` (A) and
`design-system/prototypes/rounds/2026-11-08-keskustelun-aineisto-3/` (A), with
the issues' result.md host facts and decisions for later review.

- One card shape for every offer kind (view, file, table, image, PDF,
  folder); the whole card opens the item in the right-hand panel and pressing
  the same card again closes it; the open card is highlighted.
- Hover corner icon row on the card (publish, own tab, download), always
  visible on touch; the same row in the panel top bar.
- A chip in the bottom strip next to Workers with view and file counts,
  opening the conversation's list of views and files (views grouped by
  version as in the prototype); list rows have the same hover icons at their
  right end; a row opens the item in the same panel and pressing it again
  closes it. The top-bar file button goes if the prototype removes it.
- Publishing uses today's view method (*Julkinen*, duration, *Kopioi
  linkki*). For kinds the host cannot publish yet, the publish icon is absent
  or disabled with a reason; making file/table/image/folder offers public is
  `public-file-offers`.

Not experimental: it replaces today's inconsistent cards, which Jari called
disturbing; record it if a part has to be gated.

## Acceptance Criteria

- [ ] All offer kinds share the card and open in the panel; second press closes.
- [ ] Assets chip and list with hover icons; own tab and download work for every kind.
- [ ] Touched specs green; screenshots 1440/390 light/dark; `KOKEILTAVAA.md` line.
