---
created: 2026-10-17
updated: 2026-10-17
type: task
reporter: jari
status: done
priority: high
lane: web
collision: [web/src/components/, design-system/]
preparation: ready
closed: 2026-10-17
---

# Catalogue every button and control; one consistent button system

Jari, 2026-10-17 ~10.05: "kaikki käyttöliittymäelementit käydään läpi ja katsotaan, että kaikki painikkeet ovat johdonmukaisesti samaa tyyliä. Ehkä ensin jokin katalogisointi ja sitten ehkä jotakin prototypointia, jos sille on tarvetta."

Concrete case (nayta-koodi.avif, Asetukset › Laitteet, light): the green "Näytä koodi" primary button is too large, and its icon sits higher than the text with no gap between them. Earlier: text buttons without a surface (`buttons-no-surface`, fixed), send arrow and + off-centre (fixed once).

1. **Catalogue**: every button and button-like control in production (primary, secondary, quiet/text, icon-only, destructive, pills, tabs/segmented, menu items, links acting as buttons) on every screen, light and dark, desktop and phone, from the lab: a page `issues/ui-control-audit/catalogue.html` (self-contained, screenshots grouped by kind with the component and CSS class that draws each) plus a short table of the variants and where they differ (height, padding, radius, font, icon size and gap, focus ring, hover/pressed, disabled).
2. **Fix plain defects now**: icon alignment and gap, oversized buttons, clipped focus rings: anything that is wrong under any reasonable system.
3. **Prototype the system** if the catalogue shows real choices: a round with three directions for one consistent set (sizes, hierarchy, icon+text rules) applied to a handful of real screens, for Jari to pick. Record the chosen system later in `design-system/design.md` and tokens.

## Acceptance Criteria
- [ ] Catalogue page and variant table committed; plain defects fixed with paired screenshots; a prototype round with questions for Jari if there are choices to make.

## Resolution

### 2026-10-17T14:37:24Z · @issuectl

Catalogue, plain defects and the prototype round are done; Jari chose Rooli ratkaisee. Implementation is implement-button-system.
