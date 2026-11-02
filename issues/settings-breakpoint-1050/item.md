---
created: 2026-11-01
updated: 2026-11-02
type: improvement
reporter: jari
status: done
priority: normal
lane: settings-layout
lane_seq: 2
closed: 2026-11-01
blocked_by: ['@settings-selectors-menu']
preparation: ready
---

# Settings sidebar folds at a 1050 px window

Jari 1.11. on `proto-settings-breakpoints`: keep the current model (the settings' own list folds by the window width, as on main), but move the breakpoint from 760 px to about **1050 px**, so the content beside the list never gets squeezed (the prototype measured 163 px of content at an 810 px window today). Check the related limits in `web/src/components/Settings.css` (760 px rules and the 800 px one) and change only what belongs to this fold; the phone layout stays. Screenshots at device scale factor 2 around the new breakpoint (1040, 1060, 1280; sidebar open and closed). Not gated.
