---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-phone-scroll
lane: unlaned
preparation: ready
closed: 2026-11-22
---

# Phone: swiping a non-scrolling area scrolls the whole window, in the wrong direction

## Description

On a phone, swiping a non-scrolling area moves the whole window, sometimes in the opposite direction from the expected content movement. The frame should remain fixed; only designated scroll regions should move.

## Acceptance Criteria

- [x] Touch swipes on header, composer, short transcript and drawer footer leave document offsets and frame positions unchanged in mobile-profile browser tests.
- [x] Long transcript touch scrolling and simulated keyboard-pan visibility remain functional.
- [x] Non-keyboard visual viewport offsets do not move the shell.

Evidence and real-device verification limits are recorded in result.md.
