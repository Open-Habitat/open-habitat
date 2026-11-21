# Result: prototype round 1

## Saatesanat

Tarjouskortin otsikkoa ei voi valita, koska koko kortti on yksi
painallus. Kortin alla on painikekerros, ja kaikki muu kortin sisältö
ohittaa osoittimen, joten veto otsikon yli osuu painikkeeseen eikä tekstiin.
Kokeilin kolmea korjaustapaa tuotannon keskustelussa. Mukana on neljä
tarjousta peräkkäin, ja yhdellä niistä on pitkä otsikko. Suosittelen
suuntaa **1 Valinta**: otsikko käyttäytyy kuten muukin teksti, ja muu kortti
avaa kohteen kuten ennenkin. Kortissa on jo kolme omaa kuvaketta, eikä sille
tule uutta painiketta. Valittu otsikko kopioituu ilman perään jäävää
rivinvaihtoa, joten sen voi liittää suoraan viestiin. Suunta 3 Viittaa
palvelee juuri sinun tapaustasi nopeimmin, mutta se on uusi toiminto ja
vaatii päätöksen siitä, missä muodossa viittaus kirjoitetaan. Jos se
kiinnostaa, sen voi lisätä myöhemmin valinnan rinnalle.

## Round

Sources: `design-system/prototypes/rounds/2026-11-21-offer-title-copy/`
(`NOTES.md` has the build and check commands).
Built page: `design-system/prototypes/dist/offer-title-copy/index.html`
(`offline.html` embeds the fonts). Picker: Nyt, 1 Valinta, 2 Kopioi,
3 Viittaa. The review bar also chooses what copying gives (title only, or
kind and title) and shows what the page last copied.

Axis: **where the way to take the title lives**. Every direction uses the
production `ViewOfferCard`/`FileOfferCard` unchanged and adds only its own
piece. The cards share the replies' right edge, matching the parallel
`offer-card-right-edge` fix.

| Direction | What it decides | Keyboard and screen reader | Phone |
| --- | --- | --- | --- |
| **1 Valinta** | The title takes the pointer and selects like text: drag, double-click for a word, triple-click for the whole title. A click on the title does not open the card; the rest of the card does, and the card does not light up as a press while the pointer is over the title. Copy uses the browser's own Copy. A selection that starts in a title is copied without the surrounding whitespace, because otherwise a triple-click copy ends in a line break. | Nothing new: the card press stays one Tab stop, and the screen reader reads the title as part of the card's note. A keyboard-only user cannot select it, the same as other non-editable text. | A long press selects, and the system menu copies. A tap on the title no longer opens the card. |
| **2 Kopioi** | Production `CopyButton` (icon only) directly after the title's last word, named "Kopioi otsikko: <title>". It is faint at rest so that four cards in a row stay calm, and clear under the pointer or on focus. It shows the existing "Kopioitu" check for 2.5 s, as the card's own link copy does. | One more Tab stop per card, right after the card press. Its name includes the title, so several offers in a row are distinguishable. | Always clear, 32 px target. |
| **3 Viittaa** | A quiet "@ Viittaa" text button at the end of the facts line. It adds the title to the draft, unsent, with a space before it if the draft already has text, and puts the caret after it. This follows `Vie keskusteluun`, which appends a terminal selection to the draft. Nothing touches the clipboard. | One more Tab stop. Named "Viittaa viestissä: <title>". Focus moves to the field. | Visible, 32 px target. A long title's button wraps to a line of its own, and the card grows. |

**Recommendation: 1 Valinta.** It fixes exactly the reported defect with
the platform's own behaviour. It works for any destination, not just this
conversation's field, and allows copying part of a title. It also adds no
control to a card that already carries publish, tab and download icons.
What it gives up: a tap or click on the title no longer opens the card.
On a one-line title the card is still mostly press target: icon, facts line,
padding, chevron. Direction 2 is the fallback if the title has to stay a
press target. Direction 3 is worth a separate decision as an addition.

What copying gives: the plain title by default. A title can repeat
across kinds (a view and its CSV), so the review bar shows "kind and title"
(`taulukko ”…”`) for 2 and 3. I recommend plain. Direction 1 always copies
exactly what was selected.

No host data or contract change is assumed. The title is already in the
browser's offer model (`ViewSummary.title`, `FileOfferSummary.title`).

## Questions for Jari

1. Selection (1) or a copy button (2)? With 1, a click on the title no
   longer opens the card. Is that acceptable?
2. Should copying ever add the kind ("taulukko ”…”"), or always the plain
   title?
3. Is Viittaa (3) worth having as an addition later, since it skips the
   clipboard and goes straight to the message?
4. In 2 the button shows the existing "Kopioitu" check, as the card's link
   copy does. On 15.11. you removed the terminal's copy confirmations, and the
   reply copy button has none either. Keep the check or drop it here?

## Decisions for later review

- **Click on the title in 1 does not open the card.** Alternative: open on a
  click without a selection. Reason: a double-click would then open and
  close the panel while selecting a word. A clear split (text versus the
  rest of the card) is predictable.
- **Copy trims a title selection's whitespace (1).** Alternative: leave the
  browser's copy as is. Reason: a triple-click copy otherwise adds an empty
  line to the message.
- **2's button is faint at rest rather than hover-only.** Alternative: show it
  only under the pointer, as the card's other icons appear. Reason: then it
  would be invisible until hovered, and the direction would look like Nyt.
  A faint icon tells the reader that copying exists.
- **3 appends at the end of the draft, not at the caret.** Alternative: insert
  at the last caret position. Reason: this follows `Vie keskusteluun`. The
  caret is lost when the person presses the card anyway.
- **The round's agent replies span the turn's full width.** In production the
  reply inside a turn has `max-width: none`. The round draws bare
  `AssistantMessage`s, so it gives them that width, and the offers the same
  column.

## Observed along the way (production, not changed)

On a desktop, the card's floating icon group (publish, tab, download)
covers the end of a long title's first line under the pointer. It is
visible in the 1 Valinta screenshot with the CSV card hovered. It may matter
more once the title is selectable. It is left to the `offer-card` lane
rather than filed separately, because the edge fix in progress changes the
card's width.

## Verification

- `check.mjs` (full run): 372 checks passed and the console stayed clean. It
  walks Nyt and 1–3 at 1440 (Päivä, Yö, Kontrasti), 1024 English, and a
  390 px touch phone (Päivä, Yö). It covers the picker, the marked
  direction line, four offers, offer right edges equal to the reply edge,
  no sideways overflow, Nyt's title unselectable, 1's triple-click selection
  and trimmed copy, click-on-title-does-not-open and rest-of-card/Enter
  opens, 2's naming, Tab order, plain and kind copies, faint/clear states,
  and button inside the long card, and 3's draft insertion, caret, second
  reference, naming and 32 px touch target.
- Screenshots (not committed): `/var/tmp/agent-keep/offer-card-title-copy/shots/`.
- Not done: no host-backed lab session and no real screen reader pass. The
  page's clipboard is the review stand-in described in `NOTES.md`.
