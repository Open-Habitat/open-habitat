---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: fixed
priority: high
lane: unlaned
collision: [web/src/components/CapacityRefusal.tsx, web/src/app/PendingConversation.tsx]
preparation: ready
closed: 2026-11-07
---

# Capacity refusal covers the start page, is not a warning and hides the conversation's controls

## Description

Jari 7.11.2026, dark theme, screenshot
`evidence/jari-2026-11-07-refusal.png`: a new conversation refused at the
limit on conversations working at once shows *Keskustelua ei luotu · Ylläpitäjä
on antanut sinulle rajan 1 …* with *Mitkä pitävät paikkaa? · Yritä uudelleen ·
Muuta rajaa (ylläpitäjä)* (`web/src/components/CapacityRefusal.tsx`, placed by
`web/src/app/CapacityCard.tsx` from `web/src/app/PendingConversation.tsx`).

1. **It lies on top of the start page.** The card is drawn over the
   workspace's start page (*Aloita tästä*) content. The start page should move
   out of the way (scroll), and the refusal should sit as a banner.
2. **It does not look like a warning.** It is a plain grey card. Something
   went wrong, so it should read as one: the danger tone with its mark.
3. **Its left and right edges are wider than the column** it belongs to,
   for example the composer below it. Edges align with the composer.
4. **The conversation's own controls disappear** once the refusal appears:
   there is no archive button nor the other conversation controls, so the
   person cannot get rid of the refused conversation. Jari called this the
   big problem.

Jari also asked whether there is a base style or standard component so that
these come out right automatically. There is: `web/src/components/WarningBanner.tsx`
is the common warning (tones `progress`/`neutral`/`danger`/`success`,
placements `inline`/`page`; design rule in its doc comment and
`design-system/`), and the refusal does not use it. Build the refusal on
`WarningBanner` (tone `danger`, `inline`, with its actions and the holders
list as body) rather than restyling the card, so the next warning inherits
the same edges and tone.

This is a defect fix in agreed behaviour, not a new design: no prototype, no
experimental gate.

## Acceptance Criteria

- [x] Refusal is a `WarningBanner` in danger tone; holders list, stops, Try
      again and Change the limit keep working.
- [x] It no longer overlaps the start page; the start page scrolls away and
      the banner sits in the column with edges aligned to the composer
      (1440 and 390, light and dark).
- [x] The refused conversation keeps its controls (archive and the others it
      normally has) while the refusal shows.
- [x] Touched specs and Storybook stories updated; live check in
      `KOKEILTAVAA.md`.
