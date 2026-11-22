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

# Kierros 2: where in the bar the F hint sits

## Saatesanat

Valitsit A:n, joten kortissa ei ole F-vihjettä koskaan. Tällä kierroksella
vaihtelee vain se, missä kohtaa selitystilan palkkia vihje on ja miltä se
näyttää. A:ssa vihje on painike heti *Selitystila*-otsikon jäljessä. B:ssä
se on *Lopeta Esc* -painikkeen vieressä. C:ssä se on keskellä palkkia
hiljaisena lauseena, jonka F-osa on linkki.

Vihjeen napsautus ei kaikissa kolmessa koske viimeksi osoitettua kohtaa.
Se avaa vihjeen alle paneelin *Palaute Habitatista*. Paneelissa voit
kirjoittaa palautetta Habitatista yleensä, ja se kertoo, että kohdan
virheestä ilmoitetaan osoittamalla kohtaa ja painamalla F. Kortti päästää
irti, eikä paneelissa mainita mitään kohtaa. Kokeile napsauttaa vihjettä
heti jonkin yläpalkin kohdan osoittamisen jälkeen.

Suosittelen A:ta. Otsikon jälkeen silmä lukee palkin ensimmäiseksi, joten
vihje tulee luetuksi samalla kun huomaat olevasi selitystilassa. Palkin
alku on sivupalkin päällä, jossa selitettäviä kohtia osoitetaan
harvemmin. Palkin loppu taas on keskustelun yläpalkin päällä, ja siellä
osoitin on jatkuvasti, kun selität sen kohtia. Kapeassa ikkunassa A
säilyy ennallaan otsikon vieressä. B on tuttu näppäinriviltä, mutta se on
juuri siellä, missä osoitin liikkuu eniten, ja Lopeta on sen vieressä.
C on rauhallisin, mutta kun vihje on lauseen keskellä, sitä on vaikeampi
huomata, ja kapeassa ikkunassa lauseesta jää jäljelle vain F-osa.

## Built page

`design-system/prototypes/dist/explain-f-reminder-2/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-22-explain-f-reminder-2/build.mjs`.
A copy that outlives the worktree:
`/var/tmp/agent-keep/explain-f-reminder-2/offline.html`; the check's
screenshots are in `/var/tmp/agent-keep/explain-f-reminder-2/check/`. The
round's `NOTES.md` lists the sources, the URL parameters (`?v=1|2|3`,
`?theme=dark`, `?lang=en`, `?motion=less`) and the commands.

`check.mjs` passed 362 checks with a clean console. At 1440 px, in Päivä
and Yö and in every direction, it checks that:

- the card follows, lets the pointer through, has no report button and
  never shows the F row, not even after a rest; the hidden screen-reader
  line is in its live region;
- the hint is a button inside the bar with the F keycap, in the
  direction's place (A right after the title and before the
  instructions, B just before Stop, C centred as part of the sentence),
  and does not reach Stop;
- pointing at the hint makes no new card;
- clicking it opens the general feedback panel under the hint: the part's
  card lets go, there is no part report field, the panel does not name
  the last pointed part, its field has focus, and pointing explains
  nothing while it is open;
- Esc closes the panel, returns focus to the hint and keeps the mode; a
  press outside with typed text only nudges and keeps the text; sending
  shows the sent state, and a press outside then closes it;
- a click on a part acts and opens no report; F pins and focuses the
  field; the hint leaves while pinned; Esc unpins; a second Esc ends the
  mode.

Once per direction it checks the keyboard (Tab reaches the hint, its name
says it reports a mistake, its description says that a click opens
general feedback, Enter opens the panel, Esc returns to the hint, and a
focused part still explains itself) and a 700 px window with a mouse (the
hint keeps its keycap, is not clipped, sits between the title and Stop,
and the page does not scroll sideways). Once each: reduced motion, English,
and 390 px with touch in Päivä and Yö (no hint, the report is a button on
the sheet, no sideways scroll).

## Axis and directions

Axis: **where in the bar the hint sits and how it reads.** The card, the
keys, the panel and what a click does are the same in every direction.

| | A By the title | B At the end | C Centred |
|---|---|---|---|
| Place | Right after "Selitystila", a hairline, then the instructions | Beside Stop Esc | Middle of the bar, replacing the instructions on the left |
| Reads as | A labelled outline button: part of the mode's name | A row of keys: F and Esc | A quiet sentence; only "[F] ilmoittaa virheestä" is a link |
| What is under it | The rail's top (server name, home) | The conversation's top bar (context, model, ?, ⋯), where the pointer goes often | The conversation's title |
| Narrow window (< 800 px) | Unchanged beside the title | Unchanged before Stop | Only the F link, centred |
| Mistaken for | Little: it is the first thing after the title | A second exit control, next to Stop | Status text, not a control |

## Accessibility and touch

- **Keyboard:** the hint is a real button in the bar's tab order (in A,
  the bar's first). Enter opens the panel with focus in its field, and Esc
  returns focus to the hint. F works as before from anywhere except while
  the panel is open.
- **Screen reader:** the hint's name is its visible text ("F Ilmoita
  virheestä", in C "F ilmoittaa virheestä"). Its description says that F
  reports a mistake in the pointed part's explanation and a click opens
  general feedback about Habitat. The button has `aria-haspopup="dialog"`
  and `aria-expanded`; the panel is a labelled non-modal dialog. The card
  keeps round 1's hidden line at its end.
- **Touch:** no F key, so there is no hint; the sheet keeps its real
  **Ilmoita virheestä** button.

## What the view assumes from the host

Nothing. The general report would open a GitHub issue in a new tab with
only the person's text, the Open Habitat version and the language, like
the card's report without the card. It never reaches the host.

## Decisions for later review

- **A click on the hint opens a panel, not GitHub straight away.**
  Alternatives: open a blank GitHub issue at once; or make the hint plain
  text with no click. Chosen because the panel can say, at the moment of
  the click, that a part's mistake is reported with F, and it keeps the
  same "what is sent" text as the card's report.
- **The hint's text still says "Ilmoita virheestä"** although a click
  opens general feedback. The panel's first line bridges the two.
  Alternative: label it "Palaute" and put F's meaning only in the
  description. Kept because F and reporting a mistake are what the hint
  is there to teach (see question 2).
- **The card lets go when the panel opens, and pointing explains nothing
  while it is open.** So nothing on screen suggests that the panel is
  about the last part.
- **No general feedback on touch.** A phone's bar names only the state
  (round 9), and the sheet already has a report button for a part.
  Alternative: a small "Palaute" button in the phone bar.
- **C replaces production's instructions with its sentence** instead of
  adding a third text to the bar, which would not fit at 1440 px beside
  the instructions.

## Questions for Jari

1. A, B or C?
2. Should the hint say "Palaute" (what a click does) or "Ilmoita
   virheestä" (what F does)? Now it says what F does, and the panel
   explains the difference.
3. Should general feedback be reachable on a phone too, for example from
   the bar?
4. Should general feedback also be available outside Explain mode (for
   example in the account menu), or is the mode its natural home?
