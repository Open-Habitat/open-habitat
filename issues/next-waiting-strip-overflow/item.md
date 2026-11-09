---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: fixed
priority: high
lane: unlaned
preparation: ready
closed: 2026-11-09
---

# Next-waiting strip overflows past the window's right edge

## Description

Jari 9.11.2026, pilot.22 (on every pilot): the green/turquoise *Sillä aikaa ·
N odottaa sinua · Avaa seuraava* strip above the composer now extends so far
right that its right edge passes the browser window's right edge. A
regression from round 69's composer-stack changes (`composer-stack-gaps-uneven`
9881ef7fb, `composer-stack-phone-spec-selector`, `queued-steer-above-next-waiting`).
Fix it at once; a hotfix release follows. The strip must sit inside the
composer column exactly like the field and the queued box, at every width.

## Acceptance Criteria

- [x] The strip's left and right edges equal the composer field's at 1440, 1024, 800 and 390, light and dark; never past the viewport.
- [x] A browser check asserting that (and the same for every composer-stack part); touched specs green.
