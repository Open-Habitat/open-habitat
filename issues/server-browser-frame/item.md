---
created: 2026-11-27
updated: 2026-11-28
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:conductor-2711/server-browser-frame
lane: server-browser-frame
lane_seq: 1
preparation: pending
---

# Server browser frame: fewer control steps, no clipboard dialog, close tab, larger picture

## Description

Jari 27.11.2026, using the signed-in server browser (`web/src/text/serverBrowser.ts`
and its component): the frame around the remote picture is too heavy.

- The control sequence has separate steps: take control, *Valmis* (give it
  back), and closing the browser; a way to close the current tab is missing.
- The *Leikepöytä* menu/dialog is extra: pasting already works normally with
  ⌘/Ctrl+V without it.
- The picture is small; it should use more of the screen (or explain why it
  is a fixed size).

Agreed next action: a prototype round of the server browser's frame.
