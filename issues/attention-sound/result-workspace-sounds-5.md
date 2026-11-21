# Attention sound: the workspace strip with the real Kuvake and Nimi editors (round 5)

## Saatesanat

Nauha on nyt valitsemasi A Yksi rivi, ja sen kaikki kolme painiketta
toimivat. Kuvake avaa tuotannon oikean kuvake-editorin sellaisenaan:
Automaattinen, Kirjaintunnus, emojit, Oma emoji ja Ehdotuksia mallilta.
Nimi muuttaa tuotannon näyttönimeä, ja Ääni avaa tutun äänivalitsimen.
Jokainen aukeaa omasta painikkeestaan ponnahdusikkunana, puhelimessa
alalaidan arkkina, eikä nauhassa liiku mikään, kun arvo vaihtuu. Kuvake
päivittyy samalla otsikkoon ja sivupalkkiin. Merkit ovat nyt lopulliset.

Vaihtoehtoja on kaksi, koska vain Nimellä on aito vaihtoehto. A:ssa Nimi
avaa ponnahdusikkunan kuten kaksi muuta. B:ssä nimi muuttuu kentäksi
suoraan omassa ruudussaan.

Suosittelen A:ta. Silloin kaikki kolme painiketta toimivat samalla tavalla.
Puhelimessa nimi saa täysleveän kentän, kun B:n kenttä on siellä vain noin
110 px leveä. Lisäksi A:ssa on sama Peru ja Tallenna kuin tuotannon
nimenmuutoksessa. B on nopeampi lyhyelle korjaukselle työpöydällä. Siinä
muualle klikkaaminen tallentaa, mikä voi yllättää.

## Built page

`design-system/prototypes/dist/workspace-strip-5/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-workspace-strip-5/build.mjs`.
A copy of the built page that outlives the worktree:
`/var/tmp/agent-keep/attention-sound-workspace-sounds-5/offline.html`.
Sources, URL parameters and check commands are in the round's `NOTES.md`.

`check.mjs` passed 2086 checks with a clean console. The round directory
holds no audio, image or HTML file. Both variants were checked at 1440 and
390 px in Päivä, Yö and Korkea kontrasti.

- **Strip A.** Kuvake–Nimi–Ääni sit in one row of one height. The squares
  are equal and square, and Nimi is wider. Kuvake shows production's
  `WorkspaceIcon` and where the icon comes from. Ääni shows the final
  emblem, and the rail rows show the same icons. Nothing is clipped,
  including a two-line display name.
- **Real editors.** Kuvake opens production's `workspace-icon-dialog`, with
  the current emoji pressed. Nimi opens the rename, as a pop-up in A and as
  a field in Nimi's own box in B. Ääni opens the picker, and each of its
  ten tiles carries the final emblem. Every editor stays inside the
  viewport and is a bottom sheet on a phone. Opening any of them moves no
  strip button.
- **No shift.** The check ran in Päivä at both widths, in Finnish and
  English. It chose icons of every kind (emoji, letters, Automaattinen),
  renamed to long, one-letter and empty names, and chose sounds of
  different lengths. All three strip buttons, the heading and the open
  pop-up stayed within half a pixel.
- **Flows (1440 Päivä).** In the icon editor, an invalid own emoji is
  refused, and a valid one is saved and shown in the square, the head and
  the rail. Letters can be typed and chosen, the model footer closes the
  editor, and Esc returns focus to Kuvake. Rename works with Enter,
  Tallenna, Esc, Peru and, in B, a click elsewhere. The heading and rail
  follow, focus returns to Nimi, the folder path stays, and an empty name
  clears the display name. In the sound picker, ▶ listens without choosing
  and a press chooses. The "agent finished" ripple, English and a phone
  flow were also checked.

Screenshots (not committed):
`/var/tmp/agent-keep/attention-sound-workspace-sounds-5/check/`.

## Axis and variants

Axis: **how Nimi edits.** Kuvake and Ääni are the same in both variants.
Kuvake is production's icon picker, a pop-up anchored to the square. Ääni
is round 4's picker with the final emblems.

- **A Ponnahdus (pop-up).** Nimi opens a 380 px pop-up under the button. It
  holds production's words (Muuta näyttönimeä, Näyttönimi, Tallenna), a hint
  that the folder stays, and Peru. The field opens with the name selected.
  On a phone it is a full-width bottom sheet, like the other two.
- **B Paikallaan (in place).** Nimi's box becomes the editor: a field of the
  same size in place of the name, with ✕ and ✓ on the label row. Enter and a
  click elsewhere save, and Esc cancels. The box keeps its exact size.

## Recommendation

**A Ponnahdus.** The strip then has one way of working: every button opens
its editor below itself, and on a phone every editor is a bottom sheet. On a
phone B's field is only about 110 px wide, so a longer name scrolls inside
it. A also keeps production's Peru and Tallenna, so the person decides
explicitly. B saves on a click elsewhere, which is quick but can save a
half-typed name by accident.

## Decisions for later review

- **Kuvake uses production's trigger stretched over the square**, not a copy
  of the editor. Alternatives: give `WorkspaceIconPicker` a `trigger` prop,
  or copy its body. This round changes no production code, so the overlay
  shows the real editor unchanged. An implementation would add the
  trigger slot. The production pen badge is hidden in the square, which
  already reads as a button.
- **The head keeps the icon as a picture only**, and the head's own icon
  button and the action row's rename pencil are gone. Two entry points to
  the same editor would make the strip redundant. The alternative was to
  keep both, as production has them now.
- **Kuvake's value says where the icon comes from** (Nimestä, Kirjaimet,
  Emoji). Production's longer words (Kirjaintunnus, Automaattinen) do not
  fit a 104 px phone square whole. `auto` and no setting both read
  Nimestä, because without a repository logo they look the same. A logo
  would add a fourth word, Logo. No logo is shown in this round, because
  the offline page cannot serve the image.
- **An empty name clears the display name**, and the folder's name shows
  again. The pop-up hint says so.
- **A long display name wraps to two lines on the desktop and three on a
  phone, then ends in an ellipsis.** The whole name stays in the heading,
  the title and the editor. Round 4 refused an ellipsis because the
  folder name is an identifier people copy. A display name is free text,
  and the identifier stays under the heading as `~/src/<folder>`.
- **B saves on a click elsewhere**, like renaming a file in a file manager.
  The alternative, cancelling on a click elsewhere, loses typing silently.
- **B keeps the label "Nimi" while editing.** The field's accessible name is
  "Näyttönimi". The visible "Näyttönimi" was cut to "Näytt…" on a phone.

## Storage and host needs

There is nothing new. Kuvake writes the repository's `.open-habitat.yaml`
`icon` through the existing workspace-icons path. Nimi uses the existing
rename (display name) path. Ääni uses the personal workspace→sound map from
round 1. No authority moves.

## Questions for Jari

1. **A Ponnahdus or B Paikallaan?** Or A, as recommended?
2. Is it right that the head's own icon button and the rename pencil
   disappear, so that the strip is the only place to change these?
3. Kuvake says where the icon comes from (Nimestä, Kirjaimet, Emoji). Is
   that useful, or should the square show only the icon and the word
   Kuvake?
4. Is this enough to implement the strip, or does it need another round?
