---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-11-22/server-browser-popup-close-noop
lane: unlaned
preparation: ready
closed: 2026-11-22
---

# Server browser: the popup's × in the window list does nothing

## Acceptance Criteria

- [x] Closing a sole popup through the viewer leaves a fresh blank page with keyboard focus; verified with real Chrome and Xvnc in a disposable synthetic host.
- [x] Normal popup close and self-close leave the opener usable.
- [x] Investigate opener navigation, renderer crash, noopener and session restore; record evidence and unresolved limits in result.md.

## Description

Test server (pilot.853, 22.11.2026, after server-browser-popup-takes-over landed): in Oma selain's top-bar window list the popup's × does not close the window or anything else. Agent 'browser status' at that moment shows the person in control and only one window, about:blank#ponnahdus, opened by window.open('about:blank#ponnahdus','pop',…); the main window is not listed — check whether the main window disappeared or a browser restart restored only the popup. The rest (top bar, paste, conversation card) passed.
