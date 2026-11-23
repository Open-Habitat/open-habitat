---
created: 2026-11-22
updated: 2026-11-23
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-11-22/view-location-href-replaces-frame
lane: unlaned
preparation: ready
closed: 2026-11-23
---

# A view's location.href navigation replaces the frame with an error page

## Description

Test server (pilot.853, 22.11.2026): a button in a view doing location.href='https://example.com/' turns the frame into the browser's 'content cannot be shown' page: the navigation starts and only CSP blocks the load, so the view is lost. top.location.href correctly errors. Expected: the navigation is blocked and the view stays. Related: view-frame-navigation-frame-src.

## Decisions

### 2026-11-23T05:43:12Z · @jari

Jari 23.11.2026: accepted — when a view's navigation is blocked, show 'Näkymä yritti avata toisen sivun' with an 'Avaa näkymä uudelleen' button instead of the browser's error page. He hit a similar blocked-content case at once: a prototype view whose iframes show 'This content is blocked. Contact the site owner'. Next action: implement the reopen fallback and handle the nested-frame case too.
