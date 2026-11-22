---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-server-browser-paste-flow
lane: server-browser-paste
lane_seq: 1
preparation: ready
closed: 2026-11-22
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

## Decisions

### 2026-11-22T12:49:47Z · @jari

Jari 22.11.2026, superseding the round's three directions: overload Ctrl/Cmd+V to type the clipboard text as keystrokes directly, with no popover or chip; the text never goes to the remote clipboard. Conductor's safe defaults for implementation: the text comes from the trusted paste event (no permission prompt); fall back to the remote-clipboard paste with the existing count-only notice only when the text cannot be typed (characters outside the preloaded keymap, e.g. emoji/CJK) or is very long; a newline is typed as Enter only into a multi-line field, otherwise the multi-line text goes the clipboard route. Keep from the round: focus returns to the page after the Leikepöytä popover's Kirjoita näppäilyinä, and the eye toggle on the hidden field. Implementation: server-browser-paste-as-keys, after server-browser-one-bar lands.
