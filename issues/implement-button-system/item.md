---
created: 2026-10-17
updated: 2026-10-17
type: task
reporter: jari
status: open
priority: high
lane: web
lane_seq: 1
collision: [web/src/components/, design-system/]
related: ['@ui-control-audit']
preparation: ready
---

# Implement the chosen button system (Rooli ratkaisee)

Implement the button system Jari chose on 2026-10-17 in `ui-control-audit` ("Rooli ratkaisee"); the decision, the three directions and his observations are in `issues/ui-control-audit/result.md`, the prototype round in `design-system/prototypes/rounds/` (the ui-control-audit round) and the catalogue in `issues/ui-control-audit/catalogue.html`.

- **One button primitive** in `web/src/components/` with a size scale by role: the screen's main action (onboarding, confirmation, send) 44 px; an action in a card or list row 32; pills, segments and controls inside the composer or strip 26. On the phone row actions grow to 40 and inline controls to 32. Shared hierarchy (primary filled, secondary outlined, quiet tinted, danger, danger-soft), icon left of the text on its centre line with a fixed gap, 8 px radius (pills fully rounded).
- **Segmented choices and strip pills belong to the same primitive** (Teema, ajattelutaso, Ohjaa/Työn jälkeen, account-menu theme, background-strip pills): one size scale and one focus ring, not separate CSS per view. Jari: "Ehdottomasti. Näin pitää olla."
- **Native disclosures** (Valmiit, Arkisto) get the rail's chevron instead of the browser's ▶ marker.
- **Focus must fit the ordinary flow.** In the prototype, adjacent buttons' rings overlapped and a row above clipped the first control's ring. The ring must stay whole and non-overlapping in tight groups and at the top edge of scrolling containers; shrink or inset it as needed. If no simple ring works, stop at the best available ring and file a prototype issue for how focus is shown (Jari asked for a round rather than a guess).
- Replace the local size overrides the catalogue found (about 20) with the named sizes, and record the system in `design-system/design.md` and the tokens.

## Acceptance Criteria
- [ ] Every button-like control in production uses the primitive at its role size; the catalogue's local overrides are gone.
- [ ] Paired before/after lab screenshots (light, dark, desktop, phone) of Laitteet, Tili/Ulkoasu, the workspace page, the conversation's lower area and the trash dialog, including keyboard focus in a packed row and at a container's top edge.
- [ ] `design-system/design.md` and tokens describe the three sizes and the focus rule.
