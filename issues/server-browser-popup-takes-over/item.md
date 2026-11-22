---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: testing
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-server-browser-popup
lane: server-browser-popup
lane_seq: 1
preparation: ready
---

# Server browser: a popup window takes over the picture and cannot be closed

## Description

Jari (22.11.2026, test server): a site's popup window opens in the server
browser, but it takes over the whole picture. There is no window management:
the popup cannot be closed or moved aside, and opening the browser view shows
only the popup on top of the main window. (Xvnc runs without a window manager,
so Chrome's popup windows have no frame or close button.)

Next action (defect, fix directly): the person can see, switch to and close
popup windows, and get back to the main window.
