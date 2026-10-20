---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: normal
lane: phone
lane_seq: 1
collision: [web/src/app/layout-phone]
---

# Phone: the keyboard covers the text field, and opening a conversation with a status overview does not scroll to the bottom

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 on phone: while writing, the on-screen keyboard sits on top of the composer text field. Opening a conversation that shows the status overview (tilannekatsaus) does not bring focus/scroll all the way down. Use visualViewport / interactive-widget handling so the composer stays above the keyboard; scroll to the latest content on open including the overview. Verify on iOS Safari and Android Chrome emulation.
