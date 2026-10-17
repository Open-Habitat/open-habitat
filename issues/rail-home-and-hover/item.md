---
created: 2026-10-17
updated: 2026-10-17
type: bug
reporter: jari
status: in-progress
priority: normal
lane: web-feedback
lane_seq: 1
collision: [web/src/components/Navigation.tsx]
preparation: ready
---

# Rail: server name goes home; Etusivu hover visible

Jari on the test server, 2026-10-17 ~17.50:

- **Server name opens the home page.** "Serverin nimi vasemmalla ylhäällä: tämän klikkaaminen pitäisi viedä etusivulle." The server name at the top of the rail does nothing on click; it should navigate to the home page like Etusivu.
- **Etusivu hover is invisible.** "Etusivu-painike on mouse over saman värinen kuin tausta." The rail's Etusivu row takes the background colour on hover, so hover gives no feedback. Check the other rail rows and both themes for the same.

The button system (`implement-button-system`) is landing in parallel; rebase onto it and use its primitive and hover rules if it has landed.

## Acceptance Criteria
- [ ] Clicking the server name navigates home (mouse and keyboard; phone drawer closes).
- [ ] Etusivu and other rail rows show a visible hover state in light and dark; paired screenshots.
