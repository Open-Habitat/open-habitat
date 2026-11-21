# Attention sound: choosing a workspace's own sound, and where it is chosen

## Saatesanat

Tässä kierroksessa valitaan työtilan oma ääni. Valitsin on kaikissa
kolmessa suunnassa sama ponnahdus. Ensimmäisenä on ”Sama kuin oletus”,
jossa näkyy oletusäänen merkki ja nimi. Sen alla ovat kymmenen ääntä
valitsemillasi B Väreilyn muoto -merkeillä. Painettu ääni soi ja valitaan
heti, ja ponnahdus jää auki, joten voit kuunnella muita ennen kuin suljet.
Äänet soivat lyhyinä, koska Lyhyet on oletus, ja alalaidassa lukee, missä
pituuden voi vaihtaa.

Suunnat eroavat siinä, mistä ponnahdus avataan ja missä valinta näkyy
jälkeenpäin. A lisää työtilan otsikon toimintoriviin äänipainikkeen, jossa
on äänen merkki, ja oma ääni näkyy myös pienenä merkkinä sivupalkin
rivillä. B laittaa työtilan nimen alle pillerin, jossa on merkki ja äänen
nimi, esimerkiksi ”Pisara” tai ”Kalimba · oletus”. C pitää valinnan vain
Asetuksissa, jossa jokaisella työtilalla on oma rivinsä. A:ssa ja B:ssä on
myös nämä Asetusten rivit, ja ne avaavat saman ponnahduksen.

Suosittelen B:tä, ja sen rinnalle Asetusten rivejä. Pilleri kertoo työtilan
äänen sekä sanana että merkkinä siellä, missä työtilaa katsotaan, ja
ponnahdus aukeaa siitä yhdellä painalluksella. Sivupalkkiin ei tule uutta
merkkiä työtilan kuvakkeen viereen. Tilannevalitsimesta näet myös
oletusta seuraavan työtilan, suljetun ponnahduksen, pitkät äänet ja
tilanteen, jossa äänet ovat pois.

## Built page

`design-system/prototypes/dist/workspace-sound-picker/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-workspace-sound-picker/build.mjs`.
A copy of both built pages that outlives the worktree:
`/var/tmp/agent-keep/attention-sound-workspace-sounds/offline.html`.
Sources, URL parameters and check commands are in the round's `NOTES.md`.

`check.mjs` passed 434 checks with a clean console. The round directory
holds no audio, image or HTML file. The page was checked in three
directions at 1440 and 390 px in Päivä, Yö and Korkea kontrasti, each with
the pop-up open on its default view, closed after a choice, and open on a
workspace that follows the default. One flow per direction was clicked
through on a desktop: a press plays the exact short render and chooses,
the pop-up stays open, arrows move the choice and play, Sama kuin oletus
plays the default, Valmis and Esc close and return focus, and the entry
point and Settings row follow. Also checked: the Settings row opening the
same pop-up, the length link, long sounds, sounds off, "agent finished"
per workspace, English, and a phone sheet flow.

Screenshots (not committed): `/var/tmp/agent-keep/attention-sound-workspace-sounds/check/`.

## Axis and directions

Axis: **where a workspace's own sound is picked from, and where the choice
shows afterwards.** The pop-up and its content are the same in all three.

- **A Otsikossa (in the header).** A sound button with the effective
  sound's emblem in the workspace head's action row, beside Copy path,
  Rename and Archive. A workspace with its own sound also gets a small
  emblem at the end of its rail row; one that follows the default gets
  none. The button is quiet among the actions, and its meaning has to be
  learned from the emblem or the tooltip. The rail mark tells which
  workspaces have their own sound, but it competes with the workspace icon
  and the rail's state marks.
- **B Nimen alla (under the name).** A pill under the workspace name and
  path, with the emblem, the sound's name and a chevron: "Pisara", or
  "Kalimba · oletus" when it follows the default. Pressing it opens the
  pop-up. The choice reads in words without hovering, and the rail stays
  as it is. It adds one line to the workspace head.
- **C Asetuksissa (Settings only).** Settings › Äänet › Työtilojen äänet:
  one row per workspace with its emblem, its name and a button with the
  current choice that opens the pop-up. The workspace itself shows
  nothing. All workspace sounds are in one place to compare, but nothing
  in the workspace tells that it has a sound or how to change it.

Shared:

- **The pop-up.** Title and workspace name, one line of help, "Sama kuin
  oletus" first, then a 5 × 2 grid of the ten B emblems with names and the
  current length in seconds. The chosen option is outlined and says
  *Valittu*; the playing one ripples and says *Soi*. The options are one
  radio group: Tab reaches the chosen one, and arrows, Home and End move
  the choice and play it. The foot says the sounds play short (or long)
  "as when an agent finishes" and links to Settings for the length.
  Valmis and Esc close and return focus to where the pop-up opened from.
- **Phone.** The pop-up is a bottom sheet, as production's workspace icon
  picker is, and the grid stays five columns with smaller emblems.
- **Afterwards.** Every emblem of a workspace (header button, pill, rail
  mark, Settings row) ripples when that workspace's agent finishes, so the
  emblem links the sound you hear to the workspace.
- **Sounds off.** The pop-up says the choice is saved and listening still
  works; "agent finished" stays silent.

## Recommendation

**B Nimen alla, with the same pop-up from the Settings rows.** The
workspace's sound is a property of the workspace, so the place to see and
change it is the workspace itself, and the pill says it in words, which
an icon button in A's action row does not. Settings keeps the overview of
every workspace for someone setting several at once. A's rail mark is the
reason not to pick A: the rail already carries the workspace icon, state
marks and counts, and a sound emblem there would be noise on every glance
for a setting that changes rarely. C alone hides the feature from the
person who is looking at the workspace and wonders which sound it plays.

## Decisions for later review

- **A press chooses at once; there is no separate Listen or Save.**
  Alternatives: a ▶ on each tile with a confirm button, or choose only on
  Valmis. The pop-up stays open, so trying several sounds is listening
  before choosing, and one press undoes a choice. It matches the Settings
  tiles (a press plays and chooses), and production's icon picker also
  writes a choice without asking.
- **"Sama kuin oletus" is an explicit option, stored as the absence of a
  workspace sound.** A workspace that follows the default follows a later
  change of the default. The alternative, copying Kalimba into the
  workspace, would freeze it.
- **The pop-up plays the person's chosen length.** It does not offer a
  per-workspace length: Jari decided one length setting for all sounds.
- **Production has no rail `…` menu for a workspace**; its own actions live
  in the workspace head ("the rail and home lead to the workspace"). So
  "the workspace's own menu" was read as the head's action row (A) and the
  head itself (B), not as a new rail menu.
- **The pill shows the default too ("Kalimba · oletus")**, rather than
  appearing only when there is an own sound. Otherwise there would be no
  way into the picker from the workspace for a workspace that has none.
- **The emblem colour: accent for an own sound, muted for the default**, in
  A's button and B's pill, so an own sound is seen at a glance.
- **Settings shows the default sound as a summary row** in this round; the
  real Settings page has round 6's tiles there. That keeps this page about
  workspace sounds.

## Storage and host needs

Nothing new beyond earlier rounds: workspace sounds are a personal map from
workspace to sound id in the person's preferences, a missing entry meaning
"Sama kuin oletus". The workspace head and Settings read and write the same
map. Nothing is written into the repository, unlike the workspace icon,
because the sound is personal and other people sharing the repository may
choose differently. No authority moves.

## Questions for Jari

1. **A, B or C?** Or B and the Settings rows, as recommended?
2. Should the **sidebar** show a workspace's own sound at all (A's small
   mark), or is the workspace head and Settings enough?
3. Is **"press chooses at once, the pop-up stays open"** right, or do you
   want listening and choosing separate (a ▶ per sound and a Valitse)?
4. Should the pill under the name show **"Kalimba · oletus"** for a
   workspace that follows the default, or appear only once the workspace
   has its own sound (and be reached otherwise from Settings)?
