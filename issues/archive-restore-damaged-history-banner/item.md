---
created: 2026-11-15
updated: 2026-11-15
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-15/archive-restore-damaged-history-banner
lane: unlaned
lane_seq: 1
preparation: ready
---

# Restoring an archived conversation with damaged history gives a wrong reason and a banner that sticks

## Description

Jari 15.11.2026 (test server): an archived conversation whose session file
got a broken last line (a deliberate test) could not be restored from the
archive, and the banner said "Arkiston muutosta ei tehty – Palautusta ei
tehty: Tila muuttui toisaalla. Päivitä tiedot ennen uutta yritystä."
Two defects: (1) the reason is wrong — nothing changed elsewhere; the
history's last line is broken, and the message must say that, as the
"Agentti ei käynnistynyt" notice already does (file kept, damaged line);
(2) the banner cannot be closed and follows into the next conversation and
stays there. Writing to a resting, non-archived damaged conversation was not
tried.
