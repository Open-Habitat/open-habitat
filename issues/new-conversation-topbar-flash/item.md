---
created: 2026-10-13
updated: 2026-10-13
type: bug
status: fixed
priority: normal
lane: web
lane_seq: 17
collision: [web/]
closed: 2026-10-13
closed_by: claude
---

# New conversation flashes an extra archive-state button in the top bar

Jari, 2026-10-13 on the test server: opening a new conversation briefly
(about a third of a second) shows something extra in the top bar, a large
button with text like "Arkiston tila …", before the bar settles to the
agreed Ikonirivi.

## Agreed behaviour

The top bar renders its final layout from the first paint; a pending or
loading state uses the bar's own disabled-with-reason form, not a different
transient control. Find which component renders the flash (likely an
archive-state or loading placeholder before the conversation's facts arrive)
and remove the transient form.

## Done when

- The flash is reproduced in the lab (slowed network or a recorded frame
  sequence) and gone after the fix; evidence in
  `issues/new-conversation-topbar-flash/`.

## Reopen Notes — 2026-10-13

Re-stamped after the native-history restore correction and final browser validation; the first-paint loading-icon fix remained unchanged.

