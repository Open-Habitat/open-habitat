---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: needs-info
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-11-22/view-location-href-replaces-frame
lane: unlaned
preparation: ready
---

# A view's location.href navigation replaces the frame with an error page

## Description

Test server (pilot.853, 22.11.2026): a button in a view doing location.href='https://example.com/' turns the frame into the browser's 'content cannot be shown' page: the navigation starts and only CSP blocks the load, so the view is lost. top.location.href correctly errors. Expected: the navigation is blocked and the view stays. Related: view-frame-navigation-frame-src.
