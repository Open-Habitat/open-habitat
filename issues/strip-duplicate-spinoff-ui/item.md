---
created: 2026-10-17
updated: 2026-10-17
type: bug
reporter: jari
status: fixed
priority: normal
lane: web-feedback
lane_seq: 3
collision: [web/src/components/BackgroundStrip.tsx]
preparation: ready
closed: 2026-10-17
closed_by: worker
---

# A second spinoff component above the strip pills

Jari on the test server, 2026-10-17 ~17.48 (B4 of KOKEILTAVAA, `implement-background-strip`): "siinä on tavallaan ne tabletit ja niiden tablettien päällä toinen tällainen jonkin näköinen käyttöliittymäkomponentti niihin spinoffeihin. Mä oletan, että se ylempi on tavallaan virhe. Tai joku vanha jääne. Mutta ne tabletit toimivat musta oikein."

With a background process and a spinoff running, the composer area shows the new strip pills (correct) and, above them, a second, older spinoff UI component. The pills are the chosen design (`design-system/drafts/`, `implement-background-strip`); the upper component is presumably a leftover of the earlier spinoff/process presentation (e.g. `ProcessTray`, the conversation's spinoff group, or a waiting row) still rendered in that state. Find which component it is and remove the duplicate presentation so only the strip remains above the composer; keep the in-thread Spinoffit group (`spinoff-group-disappears`), which belongs to the timeline, unless it is the duplicate.

Jari's screenshot is on his Mac (`/Users/maintainer/Library/Application Support/CleanShot/media/media_kxniJIfi9F/CleanShot 2026-10-17 at 17.48.27@2x.png`, fetch with `tw fetch <path>` when maple is reachable); it was not reachable when this was filed.

## Acceptance Criteria
- [ ] With a running process and a running spinoff, only the strip pills appear above the composer; lab screenshot before/after, desktop and phone.
