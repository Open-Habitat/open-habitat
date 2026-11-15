---
created: 2026-11-15
updated: 2026-11-15
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-15/terminal-mac-copy
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-15
---

# Terminal copy shortcut on a Mac: Shift+Cmd+C opens the inspector

## Description

Jari 15.11.2026 (Mac, Brave/Chrome): the terminal's copy shortcut as shown (Ctrl+Shift+C, which a Mac user reads as Shift+Cmd+C) does not work: in Chrome and Brave on macOS Shift+Cmd+C opens the DevTools element inspector.

Code: `web/src/components/Terminal.tsx` key handler — Ctrl+Shift+C always copies, Ctrl+C copies with a selection, and every Cmd key is left to the browser ("Cmd+C and Cmd+V stay with the browser on a Mac"). The Explain texts (`web/src/text/explainMode.ts`) name only Ctrl+Shift+C / Ctrl+C.

Expected: on a Mac, Cmd+C copies the terminal's selection (xterm's or the one tmux reported), and every hint names the Mac key (⌘C); no hint leads a Mac user to Shift+Cmd+C.
