---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: jari
status: fixed
priority: high
lane: attach-focus
lane_seq: 2
preparation: ready
closed: 2026-11-02
---

# Paperclip opens a menu with one option instead of the file picker

## Description

Jari 2.11. (iPhone, screenshots): in a conversation the composer's paperclip
opens a sheet (`AttachmentMenu`, "Tiedosto liitteenä…" / "Liite lähettää
valitsemasi tiedoston.") whose only choice is to pick a file. That is an
extra step. It should behave like the paperclip in the workspace icon wish
field: pressing it opens the system file picker directly.

When the menu has a single option, the paperclip goes straight to it; keep
the menu only if a real second choice exists (and say in result.md whether
any does today). Keep the composer's focus behaviour from
`attach-keeps-composer-focus` (on a phone, the keyboard is not forced open
after the picker unless the field had focus).

## Acceptance Criteria

- [ ] Paperclip opens the file picker directly on desktop and phone; no one-option menu.
- [ ] Tests updated; a browser case asserts the picker opens without a menu.
