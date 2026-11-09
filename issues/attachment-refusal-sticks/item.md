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

# Attachment refusal message never goes away

## Description

Jari 9.11.2026, pilot.23: after a too-large attachment was refused
(*2022 on 142 Mt, ja yksi liite voi olla enintään 20 Mt. Sitä ei liitetty.*),
the message stays above the message field permanently. It should clear when
the person attaches a file that is accepted, removes or changes the
attachments, sends, or dismisses it (a close control), and not survive
switching conversations. Fix the lifetime now; its look is
`proto-attachment-refusal`'s decision and is not part of this fix.

## Acceptance Criteria

- [x] The refusal clears on a later accepted attachment, on send, on dismiss, and on switching conversation; it stays while still relevant.
- [x] Test reproducing the stuck message; touched specs green.
