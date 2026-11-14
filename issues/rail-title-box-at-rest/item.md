---
created: 2026-11-14
updated: 2026-11-14
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-14/rail-title-box
lane: unlaned
lane_seq: 1
collision: [web/src/components/components.css]
preparation: ready
closed: 2026-11-14
---

# Rail row shows the rename field's box at rest

## Description

Observed on the test server (14.11.2026): a conversation row in the left rail
(the selected row, title "Kokeile testikoneella", time "nyt") shows a
rectangular box border around its title all the time, as if the rename text
field's border were permanently visible, and the box runs too far right,
under the time. Renaming itself works well; only the at-rest look is wrong:
the box should appear only while renaming.

Suspect: a recent contrast change that raised control and state-box
boundaries to 3:1 (`df4346d3`) or the theme work (`64752848`) giving the
row's title control (rename input/button in `web/src/components/Navigation.tsx`
/ `QuietSection.tsx`, `RailRename`) a visible border at rest.
