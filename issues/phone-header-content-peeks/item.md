---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Phone: scrolled content peeks above the sticky top bar in the repository view

## Description

Jari 9.11.2026, phone: in the repository (workspace) view the top bar itself
sits at the very top, but when the page is scrolled, the text scrolling
underneath shows through as a thin strip *above* the top bar. The bar should
cover everything above its bottom edge; nothing from the scrolled content may
be visible between the bar and the top of the screen. Likely a gap between
the sticky/fixed bar and the viewport top (safe-area inset, `top` offset, a
margin or a translucent strip) on mobile browsers. Defect in agreed
behaviour; fix directly, no prototype.

## Acceptance Criteria

- [ ] At 390 wide, scrolling the repository view shows no scrolled content above the top bar (light and dark, with and without a safe-area inset).
- [ ] A browser check that scrolls the view and asserts nothing of the content is painted above the bar; touched specs green.
