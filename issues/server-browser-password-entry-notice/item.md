---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-server-browser-password-entry-notice
lane: server-browser-control
lane_seq: 4
preparation: ready
closed: 2026-11-22
---

# Server browser: typing a password as keystrokes is the obvious route, with an honest exposure note

## Description

Follow-up of server-browser-password-manager (Jari 22.11.2026 chose option 1):
the person moves one credential from their own password manager into the server
browser with Kirjoita näppäilyinä. Make that the obvious password route and
say honestly, where it is offered, that the typed password reaches the page and
is not hidden from the agent; update the agent browser skill.

## Acceptance Criteria

- [x] Separate masked password entry leads with keystrokes, clears after sending and carries the Finnish/English exposure note; ordinary-text paste remains available.
- [x] Agent guidance never asks for passwords in chat and describes keystroke or paste entry.
- [x] Web checks and focused repeated server-browser tests pass; synthetic visual review and limitations are recorded in result.md.
