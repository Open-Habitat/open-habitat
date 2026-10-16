---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# Settings: server name not live; storage column wraps

Jari on the test server, 2026-10-16, in the settings (Osiot):
1. Changing the server name in administration did not update the name in the top-left corner immediately.
2. On the Käyttäjät (users) tab, the Tallennustila (storage) column wraps onto several lines (`kayttajat-tallennustila.png`).

## Acceptance Criteria
- [ ] The renamed server name shows immediately in the top-left corner (and anywhere else it is shown) without a reload; browser test.
- [ ] The storage column stays on one line at desktop width, with a sensible narrow-screen layout; lab screenshots.
