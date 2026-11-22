---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-server-browser-paste-flow
lane: server-browser-paste
lane_seq: 1
preparation: ready
---

# Prototype: paste and keystroke flow in the server browser (Ctrl+V guidance, focus back to page, eye toggle)

## Description

Jari (22.11.2026, trying the test server) wants the paste / "Kirjoita näppäilyinä"
interaction prototyped:
- when the person presses Ctrl+V / Cmd+V on the server browser, open the
  clipboard panel with guidance: the clipboard does not go into the page
  directly, and passwords should not go through the clipboard (security);
- after "Kirjoita näppäilyinä" the focus should return into the remote
  browser, so the next keys (e.g. Backspace) go to the page; today they stay
  in the text box;
- the hidden text field gets the familiar eye toggle (eye / struck-through eye)
  at its right edge to show or hide the text.
Next action: a prototype round of this interaction; Jari picks; then implement.
