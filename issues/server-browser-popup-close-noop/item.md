---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-11-22/server-browser-popup-close-noop
lane: unlaned
preparation: ready
---

# Server browser: the popup's × in the window list does nothing

## Description

Test server (pilot.853, 22.11.2026, after server-browser-popup-takes-over landed): in Oma selain's top-bar window list the popup's × does not close the window or anything else. Agent 'browser status' at that moment shows the person in control and only one window, about:blank#ponnahdus, opened by window.open('about:blank#ponnahdus','pop',…); the main window is not listed — check whether the main window disappeared or a browser restart restored only the popup. The rest (top bar, paste, conversation card) passed.
