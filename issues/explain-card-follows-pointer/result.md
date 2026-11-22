# Explain card follows the pointer: prototype round

## Saatesanat

Kortti seuraa nyt kaikissa suunnissa osoitinta eikä jää paikalleen, kun
osoitin menee sen päälle: osoitin kortin päällä osoittaa sitä, mikä on
kortin alla. Vain F pysäyttää kortin, ja samalla ilmoituskenttä aukeaa
valmiiksi kohdistettuna. Napsautus toimii kuten aina eikä avaa ilmoitusta.
Esc irrottaa kortin, ja toinen Esc lopettaa tilan. Koska korttiin ei voi
enää osua hiirellä, sen alarivillä ei ole painiketta vaan muistutus
"Ilmoita virheestä · Paina F".

Näkymä on Habitatin näköinen: sivupalkki, keskustelun yläpalkki,
keskustelu työvaiheineen ja alakerta, ja niissä on noin neljäkymmentä
kohtaa oikeine korttiteksteineen. Liikuttele hiirtä vapaasti ja kokeile
erityisesti, miten kortti käyttäytyy, kun yrität mennä sen alle.

Suunnat eroavat siinä, miten kortti pysyy poissa tieltä. A:ssa kortti
kulkee osoittimen vieressä alaoikealla ja kääntyy reunoilla. B:ssä kortti
on osoitetun kohdan vieressä ja liukuu kohdan toiselle puolelle, kun
osoitin lähtee sitä kohti. C:ssä kortti on paneeli alakulmassa, ja vain
sisältö vaihtuu. Osoitetussa kohdassa on pieni ?-merkki, ja paneeli
vaihtaa kulmaa, kun osoitin tulee sen lähelle.

Suosittelen B:tä. Teksti pysyy paikallaan, kun liikut saman kohdan
sisällä, joten sen ehtii lukea. Kortti on silti aina siinä, mitä katsot,
eikä koskaan osoittimen alla tai sen tiellä. A seuraa kirjaimellisimmin,
mutta teksti liikkuu jatkuvasti ja peittää aina sen, mikä on osoittimesta
alaoikealle, eli juuri seuraavan rivin. C ei peitä mitään, mutta silmän
pitää käydä kulmassa ja takaisin, ja leveällä näytöllä matka on pitkä.

## Built page

`design-system/prototypes/dist/explain-follow/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-22-explain-follow/build.mjs`.
A copy that outlives the worktree:
`/var/tmp/agent-keep/explain-card-follows-pointer/offline.html`; the
check's screenshots are in
`/var/tmp/agent-keep/explain-card-follows-pointer/check/`. Sources, URL
parameters (`?v=1|2|3`, `?theme=dark`, `?lang=en`, `?motion=less`) and
commands are in the round's `NOTES.md`.

`check.mjs` passed 208 checks with a clean console. At 1440 px in Päivä and
Yö, in every direction, the check covers:

- a pointed part shows its card with the F reminder and no report button,
  and the card lets the pointer through;
- moving the pointer onto where the card was never leaves the pointer
  under the card;
- A trails the pointer within a part, B holds still within a part, and C
  keeps its corner across parts and marks the part;
- a click acts and opens no report;
- F pins the card and focuses the field, and the pinned card stays over
  other parts, does not move and takes the pointer;
- an empty send asks for text, and typed text survives a click elsewhere;
- Esc unpins and the card follows again, and a second Esc ends the mode;
- a sent card lets go once the pointer leaves.

It also checks once each:

- reduced motion: no transition, and A does not trail within a part;
- keyboard: Tab explains parts, and F pins and focuses the field;
- English;
- 390 px with touch in Päivä and Yö: a tap explains in a bottom sheet, the
  report is a button there, and there is no sideways scroll.

The round directory holds no image or HTML file.

## Axis and directions

Axis: **how the following card stays out of the way.** The rule is the same
in every direction: the card never takes the pointer until F pins it. F opens
the report field, a click never opens the report, Esc unpins and a second
Esc ends the mode.

| | A Beside | B Sidestep | C Corner |
|---|---|---|---|
| Where the card is | Beside the pointer, below right (18/22 px) | Beside the pointed part, below it by preference, at the x where the pointer entered | A panel in the bottom corner |
| What it covers | Whatever is below right of the pointer | Neighbouring parts, never the pointed one unless the part is larger than the room around it | A fixed area of the view |
| How it gets out of the way | Flips sides at the viewport edges (with hysteresis) | Slides to another side of the part when the pointer, outside the part, comes within 36 px of it | Changes corner when the pointer comes within 40 px |
| Motion | Trails the pointer (90 ms) | Jumps to a new part, slides (180 ms) only to sidestep | Content swap; slides (200 ms) on a corner change |
| Reduced motion | Moves only when the part changes or the pointer would go under it | No slide | No slide |
| Keyboard focus | Below the focused part | As with the pointer, entry at the part's centre | Corner; changes corner if the part is under it |

## What the view assumes from the host

Nothing new. The mode reads only the rendered view, as production does. The
report is still the prefilled public GitHub issue chosen in
`explain-mode-feedback`. The prototype does not open GitHub; it says so in
the sent card.

## Decisions for later review

- **No report button on a following card.** The card never takes the
  pointer, so a button there could not be pressed. It shows the production
  report look as a key reminder ("Press F to stop the card and open the
  report field"). Alternative: drop the row entirely and put "F reports"
  in the bar only. Kept because the card is where the eye is.
- **A sent card lets go when the pointer leaves the area the report had
  covered.** Production does the same: the sent card is smaller, and the
  pointer resting where the note was would otherwise release it at once.
  Alternative: keep it until Esc.
- **A click outside a pinned report:** an empty report unpins and the click
  acts; typed text blocks the click with a nudge (as production). Esc drops
  typed text without asking, as production's Cancel does.
- **Focus leaving a pinned report by Tab** unpins it when it is empty and
  keeps it when it has text.
- **Touch is unchanged in substance.** A tap explains, a second tap acts,
  and the card is a bottom sheet with a real report button in every
  direction. The sheet sits above the review picker only because the
  picker is there.
- **In a text field F types.** The person tabs out to report. Alternative:
  a modifier shortcut. Rejected for now because every other explain key
  is bare.
- **Reduced motion in A** means not trailing at all (not just no easing),
  because a card moving with every pointer step is itself the motion.

## Questions for Jari

1. B, A or C? If you pick A: should the card trail with easing as now, or
   sit rigidly next to the pointer?
2. In B, the card hops away when you move towards it. Does that feel
   playful in the wrong way, or does it make clear that the card is not to
   be grabbed?
3. With F the only way into the report, the card shows a key reminder
   instead of a button. Is the reminder on every card too much? The
   alternative is to show it only in the mode's bar.
4. Should Esc ask before dropping typed text, or is dropping it fine (it
   is a short note)?
