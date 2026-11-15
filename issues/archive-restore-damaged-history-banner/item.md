---
created: 2026-11-15
updated: 2026-11-15
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-15/archive-restore-damaged-history-banner
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-15
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

## Acceptance Criteria

- [x] A stable damaged final history line produces the existing damaged-history explanation on restore; native bytes and archive state remain unchanged.
- [x] The archive-change notice can be dismissed and does not follow into another conversation.
- [x] Resting non-archived damaged-history continuation and send are tested: the reason is preserved, held input is not lost, and history is not changed.
- [x] Focused daemon, web and browser checks pass; independent review findings are assessed and fixed.
