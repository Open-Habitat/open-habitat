# Explain card follows the pointer: implementation

Direction A Vieressä from round `2026-11-22-explain-follow` is in
production behind its own experimental switch, `explain-follow`
(Asetukset › Kokeelliset ominaisuudet › Selityskortti seuraa osoitinta).
Off, Explain mode behaves exactly as before; on:

- the card sits below right of the pointer (18/22 px), flips at the
  viewport's edges with hysteresis, and trails with a 90 ms ease;
- the card never takes the pointer: the pointer over it explains what is
  under it, and it moves on;
- only F pins it, opening the report field focused; a pinned card holds
  still and takes the pointer, and shows *Kiinnitetty · Esc*;
- a click acts on the page as always and never opens the report;
- the first Esc lets the card go and drops typed text without asking; the
  second ends the mode;
- keyboard: a focused part explains itself with the card below the part,
  and F pins it;
- reduced motion: no easing and no trailing within a part; the card moves
  for a new part or when the pointer would otherwise go under it;
- touch: a tap explains, a second tap acts; the card is a sheet at the
  bottom with a real report button (round NOTES.md);
- the F reminder is the round's line (*Ilmoita virheestä · Paina F, niin
  kortti pysähtyy ja ilmoituskenttä aukeaa*), in the single `ReportKey`
  component in `ExplainMode.tsx` for the `explain-f-reminder` round.

## Checks

- `vitest run src/components/ExplainMode.test.tsx`: both modes (report
  button vs. key reminder; F pins and focuses; Esc twice; focus leaving an
  empty vs. written report) and `placeBeside` (sides, edge flip and
  hysteresis, touch sheet, reduced motion).
- `./scripts/test-focused.sh --area web`: green.
- Browser, `OH_BROWSER_WORKERS=2`/`3`: new `lab-explain-follow.spec.ts`
  (pointer over the card, click does not open, F pins and focuses, Esc
  twice, keyboard, reduced motion, phone sheet) 4/4; the untouched
  `lab-explain-mode.spec.ts` (switch off) 18/18; `settings-experimental` and
  `settings-search` 9/9.
- Go: `./internal/daemon` (experimental catalog consumers).

## Decisions for later review

- **Touch sheet placement.** The sheet sits at the bottom edge, and at the
  top (below the bar) when the tapped part reaches into the bottom sheet's
  area, so the tapped part stays visible as NOTES.md asks. Alternative:
  always bottom and scroll the part. Chosen because it needs no scrolling of
  the person's view.
- **A sent card on a following card** holds while the pointer stays where
  the report was (as production), then follows again, still showing the
  sent note until another part is pointed at. Alternative: drop the sent
  note as soon as it lets go. Kept because it is the smaller change and
  the note only confirms what happened.
- **F on a sent card** opens a new empty report for the same part, as in
  the prototype. Alternative: ignore F there.
- **Focus leaving an empty pinned report** (Tab out of the card) lets the
  card go and explains the newly focused part; a written report holds, as
  the round decided. Only with the switch on; off is unchanged.
- **No change to the bar's hint.** The prototype's bar said "F kiinnittää
  kortin"; production's bar hint stays as it is, since the card itself now
  carries the reminder and the reminder gets its own round.
- **Switch id `explain-follow`**, not `explain-mode`, which is a retired
  switch whose saved choices must stay inert.
