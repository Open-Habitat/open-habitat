---
created: 2026-10-31
updated: 2026-10-31
type: bug
status: fixed
priority: normal
provenance: agent
source_ref: taskfleet:01m682p696vmwq9sbvwy5k41hc/observed:recap-card-clipped
originating_run: 01m682p696vmwq9sbvwy5k41hc
originating_run_kind: spinoff
lane: recap-settings
lane_seq: 2
preparation: ready
closed: 2026-10-31
---

# Tilannekatsaus settings rows are clipped by their card in a narrow desktop column

## Description

## Description

Observed 31.10. in the synthetic browser host (worker run for
`settings-close-x-overlaps-content`): at a 1280×600 desktop window with the
sidebar open, Asetukset › Tilannekatsaus's settings card is narrower than
its rows. The section column is about 436 px wide; the "Hiljaisuus ennen
tilannekatsausta" row puts its fixed 280 px `ScaleSlider`
(`web/src/components/NumberControls.css`, `.ah-scale { flex: none; width:
280px }`) beside the label, the row overflows, and the card's
`overflow: hidden` cuts both the label's left edge and the value box
("3 min") on the right. The model row below is cut the same way.

Screenshot of the card: `attachments/recap.png` (1x).

## Acceptance Criteria

- [ ] At a desktop window with both rails open, no Tilannekatsaus row is
      clipped by its card (the slider shrinks or the row wraps).
