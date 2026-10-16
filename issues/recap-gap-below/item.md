---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: normal
lane: web
lane_seq: 2
collision: [web/src/app/, web/src/components/]
blocked_by: ['@model-warning-recap-picker']
preparation: ready
---

# Recap card touches the bar below it with no gap

Jari on the test server, 2026-10-16 (screenshot `recap-no-gap.png` in this directory): "Tilannekatsauksen ja sen alla olevat blokit olivat ihan kiinni toisissaan ilman että oli yhtään väliä." In other words, the recap card and the blocks below it touch, with no space between them. In the screenshot, the recap card sits directly against the read-only "Vain luku / Jatka keskustelua" bar below it. Check the same in every state where the recap shows above the composer area: the normal composer, read-only, outage notices, and the unsupported-model notice.

Expected: the spacing between the recap and what follows comes from the shared tokens in `design-system/design.md` and the draft `design-system/drafts/Agentin vuoro.proto.html` (Tilannekatsaus as a card above the field), the same in every state, on desktop and phone.

## Acceptance Criteria
- [ ] The recap has the designed gap to the composer, the read-only bar and notices in all states; lab screenshots before and after.
- [ ] A browser geometry test asserts the gap.
