# Where Explain mode says that F reports a mistake: prototype round

## Saatesanat

Kortti on sama kuin valitsemassasi A Vierellä -suunnassa. Ero on vain
siinä, missä ja milloin vihje "Ilmoita virheestä · Paina F" näkyy.
Selitystilan palkissa on kaikissa suunnissa pieni näppäinmerkki
`[F] Ilmoita virheestä`, joten vihje on aina jossain. Kortissa:

A:ssa kortissa ei ole vihjettä koskaan. B:ssä vihje näkyy kolmessa
ensimmäisessä eri kortissa. Neljännestä alkaen se puuttuu, ja palkin
merkki nyökkää, jotta näet, mihin vihje siirtyi. Kun olet kerran
painanut F:ää, vihjettä ei enää näytetä kortissa. C:ssä vihje ilmestyy
korttiin vasta, kun osoitin on levännyt samassa kohdassa vajaan sekunnin.

B:ssä katselmointipalkissa on valinta *Kokeilija*. Sillä voit katsoa
näkymää ensikertalaisena tai sellaisena, joka on jo painanut F:ää.
Kokeile B:tä ensikertalaisena: osoita neljää eri kohtaa ja katso palkkia.

Suosittelen B:tä. Ensikertalaiselle F kerrotaan siellä, mihin hän
katsoo, eli kortissa, ja juuri silloin, kun hän vielä opettelee tilaa.
Sinä olet jo käyttänyt F:ää, joten et näe vihjettä kortissa enää
koskaan. A on hiljaisin, mutta palkki on kaukana kortista, eikä
ensikertalainen välttämättä huomaa sitä. F on kuitenkin ainoa tapa
ilmoittaa virheestä. C:ssä vihje tulee juuri silloin, kun luet korttia,
ja se on hieno ajatus. Luet kuitenkin melkein jokaista korttia, joten
vihje on silloin lähes yhtä usein näkyvissä kuin nyt, ja kortti kasvaa
kesken lukemisen.

## Built page

`design-system/prototypes/dist/explain-f-reminder/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-22-explain-f-reminder/build.mjs`.
A copy that outlives the worktree:
`/var/tmp/agent-keep/explain-f-reminder/offline.html`. The check's
screenshots are in `/var/tmp/agent-keep/explain-f-reminder/check/`. The
round's `NOTES.md` lists the sources, the URL parameters (`?v=1|2|3`,
`?theme=dark`, `?lang=en`, `?motion=less`, `?learned=1`) and the commands.

`check.mjs` passed 226 checks with a clean console. At 1440 px, in Päivä
and Yö and in every direction, it checks that:

- the card follows, lets the pointer through and has no report button;
- the bar chip `[F] Ilmoita virheestä` is shown;
- the hidden screen-reader line is in the card's live region and takes no
  room;
- A shows no row, not even after a rest;
- B shows the row on cards one to three but not on card four, where the
  chip nods. An already hinted card keeps its row. After F, no card shows
  the row; the Kokeilija select follows, and "Ensimmäinen kerta" brings the
  row back;
- C shows no row at once. The row appears after a rest, does not appear
  while the pointer keeps moving within a part, and is gone on the next
  part. The card grown by the row stays in view and clear of the pointer;
- a click acts and opens no report;
- F pins the card and focuses the field, and the chip leaves while the card
  is pinned;
- Esc unpins, and a second Esc ends the mode.

It also checks once each:

- reduced motion: no row animation and no nod;
- keyboard in A and C: focus explains the part, and in C the row appears
  once focus rests;
- English;
- 390 px with touch, in Päivä and Yö: no chip and no row, the report is a
  button on the sheet, and there is no sideways scroll.

## Axis and directions

Axis: **where and when the F hint appears.** The card, the keys and the
bar chip are the same in every direction.

| | A Bar | B First cards | C On rest |
|---|---|---|---|
| Row on the card | Never | The first 3 different cards of each mode session, until F has been used once | After the pointer or focus rests 0.9 s on one part (under 6 px of movement) |
| First-time user | Has to notice the bar | Sees it where they look, three times | Sees it whenever they stop to read |
| Experienced user (has used F) | Nothing on the card | Nothing on the card | Row on nearly every card they read |
| Motion | None | The chip nods twice when the row retires | The row fades in (180 ms) and the card grows |
| Remembers anything | No | Whether F has been used (in the browser) | No |

## Accessibility and touch

- **Screen reader:** in every direction, the card's live region ends with
  a hidden line, "F: ilmoita virheestä tässä selityksessä." The visible
  row is hidden from the screen reader, so a reader hears the same thing
  in A, B and C, and hears it last, where it is easy to cut off. The bar
  chip is plain text in the bar.
- **Keyboard:** focusing a part with Tab is the same as pointing at it.
  B counts focused cards, and in C resting focus brings the row.
- **Touch:** there is no F key, so nothing in this round applies. The
  bottom sheet keeps a real **Ilmoita virheestä** button in every
  direction, and the bar keeps production's touch hint without the F chip.

## What the view assumes from the host

Nothing. B's memory of "F has been used" is per-browser presentation
state, like the theme, and never reaches the host snapshot.

## Decisions for later review

- **The bar chip is in every direction, not only in A.** A visible place
  that is always there backs up B after the row retires and C before a
  rest. Alternative: only A has it. Kept because without it B's fourth card
  would leave a newcomer with nothing to find.
- **B counts different cards, not parts.** Three conversation rows share
  one card, so pointing along the rail would otherwise use up the three
  cards in a second. Three is a judgement call; two or five would do too.
- **B's memory is "F used once", kept in the browser**, not a count of
  sessions. Someone who has reported once has learned the key.
  Alternatives: a count of mode sessions (the row comes back each session
  until N), or no memory (every session starts with three). Kept because
  it is the only option that removes the row for Jari entirely.
- **The screen-reader line is in every card in every direction.** A screen
  reader user cannot glance at the bar while moving through parts.
  Alternative: announce the hint once when the mode opens. Kept because a
  one-time announcement is lost after a few parts, and the line is short
  and comes last.
- **C's rest is 0.9 s with 6 px slack, and the row stays on that part once
  it is shown.** Small hand tremor should not count as moving, and a row
  that comes and goes while you read would be worse than either.
- **The card's row keeps production's report look (bordered, with a
  keycap)** although it is not a button, as in the previous round.
  Alternative: a plainer text line. Not riffed here because the axis is
  where and when, not how it looks.

## Questions for Jari

1. B, A or C?
2. In B, should the row also go away for good after you have seen it in
   enough sessions without ever pressing F, or only after you use F?
3. The bar chip is plain text. Should clicking it pin the card for the
   last pointed part and open the report? It would be a mouse route that
   does not need F.
4. Is three cards the right number for B?
