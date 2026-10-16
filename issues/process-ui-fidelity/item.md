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

# Process row and view do not match the agreed design

Jari 2026-10-16 14:25: the process row above the composer (`prosessit-palkki.png`) "on ihan ruma palkki eikä lainkaan sellainen kuin on sovittu" (an ugly bar, not at all what was agreed), and the opened process view (`prosessi-auki.png`) "ei lainkaan näytä siltä kuin pitäisi" (does not look the way it should). The screenshots show largely unstyled markup: plain headings ("Päättyneet"), link-like texts, no list rows, no output box. The agreed design is `design-system/prototypes/rounds/2026-10-16-prosessit/` direction 3 "Kentän yllä" and `2026-10-16-prosessilohkot/` direction 1 "Merkintänä", with Jari's Decisions in `issues/proto-processes/` and `issues/proto-processes-blocks/`.

## Acceptance Criteria
- [ ] The row, list, output view, stop and "Poista päättyneet" match the rounds in paired lab screenshots against the prototype (desktop and phone, light and dark); every deviation is justified.
- [ ] The styles come from the shared tokens and components, not one-off CSS.
