---
created: 2026-11-14
updated: 2026-11-14
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-14/view-rows-indented-differently
lane: unlaned
lane_seq: 1
preparation: ready
---

# View rows are indented differently from file rows in Näkymät ja tiedostot

## Description

Jari 9.11.2026 (test server): in the "Näkymät ja tiedostot" list, view rows
(`</>`) start their icon and title about 8 px further right than folder,
spreadsheet and image rows, so titles do not line up. In the same list a view
offered yesterday stood on its own row although it came from the same source
folder as today's twice-offered view (which correctly folded into a "2
versiota" row); either only same-day or consecutive offers fold, or the
source did not match. Jari did not consider the folding a defect; check
whether it is intended (`assets-chip-view-list-cap` says offers of the same
source share one row). The indentation is a defect.
