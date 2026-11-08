---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-08
---

# Settings' narrowest layout sits against the left edge

## Description

Jari 8.11.2026, test server pilot.647: in Settings' narrowest layout (the
one-pane list/detail at ≤ 800 px, after `settings-one-pane-desktop`, which
capped the list's width so it no longer stretches), the content settles
against the left edge, leaving empty space on the right; it looks odd.

Between the phone width and 800 px the capped column should be centred (or
fill the width with sensible side margins), consistently for the section
list and a section's content, the search box and the *← Asetukset* back row.
Check 390, 600 and 800 px, light and dark.

## Acceptance Criteria

- [x] At 390–800 px Settings' column is centred or full width with even margins, list and detail alike.
- [x] Settings specs and width sweep green; screenshots.
