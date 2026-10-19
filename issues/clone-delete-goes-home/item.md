---
created: 2026-10-19
updated: 2026-10-19
type: bug
reporter: jari
status: fixed
priority: low
lane: web-polish
lane_seq: 1
collision: [web/src/app/]
preparation: ready
closed: 2026-10-19
---

# Removing an interrupted clone lands on the new-workspace page

Jari on the test server (pilot.231), 2026-10-19: an interrupted clone was visible; he pressed **Poista keskeneräinen**. It was removed fine, but afterwards the browser jumped to the **Uusi työtila** page. "Ei se olisi voinut mennä vain etusivulle sen poistamisen jälkeen" — after removing an interrupted clone, go to the home page (or stay where the person was if it was not the clone's own page), not to the new-workspace page.

He also asked to confirm nothing was left on disk after interrupting a `northwind` clone: the conductor checked `~/src` on the VM — no `northwind` directory remains.

## Acceptance Criteria

- [x] Explicit removal returns to the home page; remaining clones stay reachable and the focused browser/fast checks pass.
- [x] Paired synthetic lab screenshots/static HTML, result and Finnish live-check entries are recorded.
