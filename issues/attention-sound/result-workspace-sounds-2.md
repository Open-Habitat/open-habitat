# Attention sound: the workspace's sound in the workspace head (round 2)

## Saatesanat

Tässä kierroksessa työtilan ääni on isona työtilan otsikossa. Suunnat
eroavat siinä, millainen otsikon äänikohta on. A on iso valitsin nimen
vieressä. Siinä on äänen merkki, nuotti ja ”Ääni” sekä äänen nimi. B on
leveä kortti nimen alla, ja siinä on iso merkki, nimi, *Kuuntele* ja
*Vaihda ääni*. C on otsikon alla nauha isoja asetuspainikkeita: Kuvake,
Nimi ja Ääni. Merkki näkyy vain isona, vähintään 32 px, ja painikkeiden
kuvake on nuotti. Oletuskin näkyy, esimerkiksi ”Kalimba · oletus”.

Kaikissa suunnissa on sama valitsin. Kortin painallus valitsee äänen, ja
kortin kulmassa oleva ▶ soittaa sen valitsematta. Sivupalkissa ei ole
pysyvää merkkiä. Nuotti tulee näkyviin vasta, kun osoitin tai kohdistus on
työtilan rivillä, ja se avaa saman valitsimen. Asetusten rivit ovat
ennallaan, mutta hyppy on korjattu. Painike on aina yhtä leveä kuin pisin
arvo, jonka se voi saada, joten painike ja sen viereen aukeava valitsin
pysyvät paikallaan. Tarkistus mittaa tämän.

Suosittelen A:ta. Se on yksi iso ja selvästi vaihdettava kohta nimen
vieressä, eikä otsikkoon tule uutta riviä yhden harvoin vaihdettavan
asetuksen takia. Jos työtilalle tulee myöhemmin muitakin omia asetuksia,
A kasvaa luontevasti C:n nauhaksi.

## Built page

`design-system/prototypes/dist/workspace-sound-picker-2/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-workspace-sound-picker-2/build.mjs`.
A copy of the built page that outlives the worktree:
`/var/tmp/agent-keep/attention-sound-workspace-sounds-2/offline.html`.
Sources, URL parameters and check commands are in the round's `NOTES.md`.

`check.mjs` passed 729 checks with a clean console. The round directory
holds no audio, image or HTML file. All three directions were checked at
1440 and 390 px in Päivä, Yö and Korkea kontrasti, each in three states:
the default view with the picker closed, a workspace that follows the
default, and the picker open. The layout-shift check opens the picker from
each Settings row and each direction's head control, at 1440 and 390 px.
It then chooses Sama kuin oletus, Jääpuikot, Tunnus puu, Kuplat, Lasit and
Pisara in turn and requires the control, the pop-up and the row's name to
stay within half a pixel. With the width reservation switched off in a
copy of the page, the check fails: the Settings button grows from 81 to
138 px and moves.

At 1440 Päivä, one flow per direction was clicked through: ▶ plays
without choosing, a press chooses and plays, arrows move the choice, the
▶ on Sama kuin oletus plays the default, and Valmis and Esc close and
return focus. Also checked: the rail note (hidden until the row is
hovered, then it opens that workspace's picker), B's Kuuntele, the length
link, long sounds, sounds off, "agent finished" making the head emblem
ripple, English, and a phone flow.

Screenshots (not committed): `/var/tmp/agent-keep/attention-sound-workspace-sounds-2/check/`.

## Axis and directions

Axis: **the shape of the workspace head's sound control.** The picker, the
rail note and the Settings rows are the same in all three.

- **A Valitsin otsikossa (selector in the head).** A large bordered selector
  between the name and the action row: a 44 px emblem, a small "♪ Ääni"
  label, the value ("Pisara" / "Kalimba · oletus") and a chevron. It is
  one control and adds no row to the head. On a phone it takes its own
  full-width line under the name.
- **B Kortti nimen alla (card under the name).** A wide card under the name
  and path: a 72 px emblem, "Soi, kun agentti on valmis tai haluaa
  huomiosi", the sound's name in large type, whether it is the
  workspace's own or the default, and two buttons, ▶ Kuuntele and
  ♪ Vaihda ääni. It explains the most and shows the emblem largest. It is
  also the heaviest: a full card on every workspace page for a setting
  that changes rarely.
- **C Asetusnauha (settings strip).** A strip of three large setting buttons
  under the head: Kuvake, Nimi and Ääni (44 px emblem and value). Rename
  moves from the action row into the strip. The sound is one of the
  workspace's settings among equals. Kuvake and Nimi are placeholders here
  and do nothing.

Shared:

- **The picker.** Sama kuin oletus first, then ten cards in a 5 × 2 grid.
  Each card has a press area (emblem, name, length or state) and a ▶ in
  its corner. A press chooses and plays the sound. ▶ plays it and ripples
  the card's emblem without choosing. The options are one radio group, and
  arrows, Home and End move the choice. The ▶ buttons are ordinary buttons
  after each option. On a phone the picker is a bottom sheet, and the
  cards become a two-column list with the ▶ at the right.
- **The rail.** No mark. While the pointer or keyboard focus is on a
  workspace row, a ♪ button appears at its end and opens that workspace's
  picker. On a touch screen it is not shown, because hover does not exist
  there. The head is the way in.
- **Settings rows.** Round 1's rows. The value now reads "Kalimba · oletus"
  like the head instead of "Sama kuin oletus (Kalimba)". The button
  reserves the width of the longest possible value.
- **Ripples.** The head's emblem ripples when that workspace's agent
  finishes, so the sound you hear is tied to the workspace.

## Recommendation

**A Valitsin otsikossa**, with the shared picker, the rail's hover note
and the Settings rows. A meets what you asked for: the sound is visible
at a glance, the control is obviously a selector, and the emblem is large.
It costs no extra row. B shows the most but puts a card on every
workspace page for something set once. C is the right shape once a
workspace has several of its own settings. Today it has only the icon and
the name, and rename already has a place in the action row, so C would
reorganise the head for the sake of one new setting. If more per-workspace
settings arrive, A's selector becomes one item of C's strip without
changing its face.

## Decisions for later review

- **A press on a card chooses and also plays the sound.** Alternatives: a
  silent choice, so that only ▶ makes a sound. Playing on choose confirms
  what the workspace will now sound like, and it matches the Settings
  tiles, where a press plays and chooses. ▶ exists for listening without
  changing the choice.
- **The value box reserves the width of the longest value** (every sound
  name, with and without "· oletus") instead of a fixed pixel width. A
  fixed width would break with English names, a longer default suffix or a
  different font. The cost is a control slightly wider than its current
  value, about the width of "Tunnus puu · oletus".
- **The phone sheet's default row keeps a fixed-width state column.**
  Otherwise "Valittu", "Soi" or nothing rewraps the text beside it, and the
  sheet's top edge moves. The check found this.
- **The rail note is hidden on touch screens.** Production's rail `…`
  shows permanently there. You asked for no permanent mark in the sidebar,
  and the head selector is one tap away on a phone.
- **Settings rows read "Kalimba · oletus"**, the same words as the head,
  instead of round 1's "Sama kuin oletus (Kalimba)".
- **The emblems are round 7's recommended variants** (Kalimba 2, Marimba 1,
  Vibrafoni 2, Tunnus puu 1, Pisara 0, Lasit 1, Tuulikello 0, Kuplat 1,
  Kulho 3, Jääpuikot 2). Round 7 has no recorded decision yet. Swapping in
  your choice is a one-line change.
- **The emblem is never below 32 px.** The pop-up's default row and the
  Settings rows use 32 px, which you approved in the rows. The head uses
  44 px (A, C) or 72 px (B).
- **C moves Rename into the strip.** Otherwise the head would have two
  rename controls. The workspace icon picker production shows at the head's
  left is left out of all three directions here, as in round 1.

## Storage and host needs

Unchanged from round 1: a personal map from workspace to sound id in the
person's preferences, where a missing entry means Sama kuin oletus. The
head, the rail note and Settings read and write the same map. No authority
moves.

## Questions for Jari

1. **A, B or C?** Or A as recommended?
2. Should a **press on a card play** the sound as it chooses it, or choose
   silently, with ▶ as the only way to listen?
3. Is the **rail note on hover** wanted at all, now that the head shows the
   sound large? And is it right to leave it out on touch screens?
4. Are round 7's **recommended emblems** the ones to use here, or do you
   have your own choice from round 7?
