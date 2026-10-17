---
created: 2026-10-17
updated: 2026-10-17
type: bug
reporter: jari
status: open
priority: normal
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# Text buttons have the page's own background and do not read as buttons

Jari, 2026-10-17 ~06.50 (kayttajat-painikkeet.avif, Asetukset → Käyttäjät, dark theme): "Poista ylläpitäjärooli" and "Raja…" have the same background as the page, so they read as bold text, not buttons. "Itse asiassa näitä on ollut täällä": the pattern is widespread. Find the shared control style (ControlButton or equivalent) and give text buttons a visible surface or border per `design-system/design.md` tokens, light and dark; audit every screen for the same.

## Acceptance Criteria
- [ ] Text buttons read as buttons in light and dark on every settings and workspace screen (paired screenshots before/after).
