---
created: 2026-11-12
updated: 2026-11-27
type: bug
status: open
priority: high
provenance: other
provenance_detail: conductor, screenshot review
source_ref: screenshot:frontmatter-1440-light/composer
lane: composer
lane_seq: 0
preparation: ready
---

# Composer action row overlaps (Tiedosto / Sanele) when the file panel is open

## Description

Seen 12.11.2026 in issues/markdown-preview-frontmatter/frontmatter-1440-light.png (synthetic lab, 1440 px, file panel open): the composer's action row overlaps: the Tiedosto button's label and the Sanele button collide ("Tiedosto ⓘtieSanele"). Check whether the composer row overflows when the side panel narrows the conversation column, at 1440 and other widths.

## Pilot report 27.11.2026

A pilot user on v0.1.9 reports it is still there ("Komentorivi on edelleen
sotkuinen, kun näkymä on kapea / vieressä kun näkyy tiedosto"). Screenshot
(not committed): with a file open in the side panel, the composer's bottom row
shows "Liitä", "/ Komennot", "Sanele" and "@ Tiedosto" drawn on top of each
other ("Komennanele@ Tiedosto"), the send button covering the end of the row.
So the row must stay legible in a narrow conversation column: labels collapse
to icons (with accessible names and tooltips) or the row wraps, instead of
overlapping. Check the narrow column both with the file panel open at common
laptop widths and on a phone.
