# Attention sound, round 3: Settings › Äänet as tiles, quiet at night

## Saatesanat

Tässä kierroksessa on Äänet-osio laattoina, kuten pyysit (kierroksen 2
suunta C), mutta laatan kuva on nyt ääni itse eikä viivapiirros. Sivu
renderöi jokaisen äänen ladattaessa (OfflineAudioContext), ja kolme suuntaa
piirtävät sen eri tavoin. A näyttää äänen verhokäyrän: pituus, iskut ja
vaimeneminen näkyvät ennen kuin painat, ja soidessa käyrä täyttyy. B
piirtää jokaisen lyönnin renkaaksi pisteen ympärille, ja soidessa renkaat
leviävät kuin vesi. C näyttää perheen kuvan ja kuvauksen, ja soidessa
tasomittari liikkuu äänen mukana. Painallus soittaa ja valitsee. Nuolilla
voi kulkea laatasta toiseen, ja jokainen ääni soi vuorollaan.

Huomioääni on nyt oletuksena päällä. "Keskustelu, jota katsot" on
henkilökohtainen valinta (oletuksena hiljaa). "Hiljennä yöllä" on
oletuksena päällä ja seuraa samaa rytmiä kuin ulkoasu. Habitatin ulkoasu ei
kuitenkaan seuraa kelloa vaan laitteen tummaa tilaa, ja selain ei kerro,
vaihtuuko se auringon mukaan vai onko laite aina tumma. Siksi rinnalla on
kello 22–7, ja jos laite on tummana keskellä päivää, rivi ehdottaa kelloa.
Yläpalkin "Agentti valmis" -painikkeista näkee, soisiko ääni nyt ja miksi
ei. Äänet ovat yhä kierroksen 1 kaksitoista ääntä paikkamerkkeinä, koska
uusi äänikierros ei ollut vielä valmis.

Suosittelen A:ta.

## Built page

`design-system/prototypes/dist/attention-sound-tiles/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-attention-sound-tiles/build.mjs`.
Sources, URL parameters and check commands are in
`design-system/prototypes/rounds/2026-11-21-attention-sound-tiles/NOTES.md`.
`check.mjs` passed with 2354 checks and a clean console. It covers three
directions × seven situations at 1440 and 390 px in Päivä, Yö and Korkea
kontrasti, the click and keyboard flows, reduced motion (both the device
setting and the review switch), and English.
Screenshots (not committed): `/var/tmp/agent-keep/attention-sound-tiles/`.

## Axis and directions

Axis: **how a tile shows its sound.** The section is identical in all
three. Only the tile changes. Every picture is read from an offline render
of the sound, so a new sound set gets its pictures for free.

- **A Aaltomuoto.** The name, the length (e.g. `0,75 s`) and the sound's
  mirrored envelope on a shared one-second scale. A short knock looks short
  and a ringing bowl long, and two strikes show as two bumps. While the
  sound plays, the envelope fills from the left and a playhead runs across
  it. Selected tiles get a stronger fill, an accent border and *Valittu*.
  The tile works without motion and in high contrast, where it is drawn as
  an outline only.
- **B Renkaat.** A larger centred emblem: one ring per strike around a dot.
  A ring's radius grows with the strike's onset time, and a sound that
  rings long gets a dotted halo. While it plays, each strike spreads
  outward at its own moment, so the rhythm is visible. It is the most
  "sound-like" in motion and the most decorative at rest. Without motion
  it reduces to the still rings, which say less than A's curve.
- **C Kuva ja taso.** The family's picture (bell, glass, Habitat arches and
  sun) in a tinted square, the name, a one-line description, and a
  14-segment level meter that follows the sound's real loudness (16 ms RMS)
  while it plays. It is the friendliest at rest and explains each sound in
  words, but within a family the four pictures are the same, so the tiles
  tell sounds apart only by text.

Shared: the tiles grouped by family (four columns at desktop width, two
on a phone), with a roving-tabindex radio group: Tab reaches the chosen
tile, arrows and Home/End move the choice and play, and focus is a visible
ring. Off or unreadable settings lock the tiles. Listening and *Testaa
ääni* still play even when the sound is off, the device is muted or it is
night, because they are explicit presses. The press also opens the
browser's autoplay gate. Reduced motion stops every animation, and the
playing tile still says *Soi*.

## Recommendation

**A Aaltomuoto.** The picture carries information that is true of the
sound (length, strikes, decay, comparable across tiles) before anything
moves. It reads the same in all three themes and with reduced motion. It
also stays meaningful when the sound set changes, because each tile is
drawn from its recipe. Take B's spreading rings as the playing animation
inside the conversation (for example on the rail row whose agent just
finished) if a "this is what just rang" cue is wanted there. In Settings
the still curve does more work.

## Quiet at night: where the rhythm comes from (proposal)

Habitat's appearance has no time-based switch. `web/src/theme.ts` follows
the device: *Järjestelmä* uses `prefers-color-scheme: dark` and picks high
contrast on `prefers-contrast: more`. The day/night rhythm is therefore the
device's own. macOS, iOS and Android switch to dark at sunset with
automatic appearance. The proposal:

- *Hiljennä yöllä* (personal, on by default) with **Mikä on yö**:
  - *Kun laite on yötilassa* (default): quiet while the device reports
    `prefers-color-scheme: dark`, the same signal the System theme uses.
    It does not use Habitat's manually chosen theme, because choosing the
    Yö theme is a look, not a time of day.
  - *Kello 22.00–7.00*: quiet by the device's local clock.
- A browser cannot tell automatic dark mode from permanent dark mode. When
  the device is dark between 9 and 17, the row shows the hint and a
  one-press switch to the clock.
- Each device decides night for itself (its own appearance or clock). The
  choice itself follows the person.

## Storage (proposal, extends round 2)

Per person in `~/.config/open-habitat/preferences.json` through
`/api/v1/account/preferences`: on/off (missing = **on**), default sound
(missing = `c1`, or the new set's default), events, `in_view_quiet`
(missing = true), `night` (missing = true) and `night_rhythm`
(`device`|`clock`). Per browser in `localStorage`: mute and volume, as in
round 2. No authority moves: the browser's app layer decides whether to
play from state it already receives, plus the device's own
`matchMedia`/clock.

## What the view assumes from the host

Nothing beyond round 2. The browser tells "finished" and "asks" from the
snapshot/SSE it already has. Night and "conversation in view" are decided
in the browser.

## Decisions for later review

- **Tiles grouped by sound family.** Alternatives: one flat grid of
  twelve, or grouping by length. The families are how round 1 designed the
  set, and they keep twelve tiles scannable. Revisit when the new sound
  round fixes the set.
- **Pressing a tile both plays and chooses, and arrows play.** Alternative:
  a separate listen button (round 2 A). Choosing by ear is the point, and
  a separate button doubles the targets on a phone. Arrow keys playing
  every step can be noisy, but they mirror the press.
- **One-second shared time scale in A.** Alternative: each envelope
  stretched to the full width. The shared scale makes lengths comparable,
  which is the information people use.
- **Night = device dark mode by default, clock as the alternative, with a
  midday hint.** Alternatives: clock only (ignores the request to share the
  appearance's rhythm), or sunrise and sunset from location (would need
  location, which Habitat does not have and should not ask for).
- **Quiet at night on by default.** Alternative: off. With sound now on by
  default, a sound in the night would be the most surprising way for it
  to reach someone.
- **"Conversation you are looking at": a two-way choice (Hiljaa / Soi
  silti), personal, default Hiljaa.** Round 2's third option ("only when
  Habitat is hidden") was dropped to keep the rule one toggle, as asked.
- **Events stay as two checkboxes.** Jari kept one sound for both. Whether
  "asks" should exist as a separate toggle at all is left open.
- **Device mute stays in Settings here.** The account menu mute is
  prototyped separately; this round does not duplicate it.
- **Round 1's sounds imported from its round directory, not copied.** One
  source while both rounds are in the tree. NOTES.md says to copy
  `synth.mjs` if round 1 is pruned first.

## Questions for Jari

1. **A, B or C**, or A in Settings with B's rings as the "just rang"
   animation elsewhere?
2. Is **night = the device's dark mode** right as the default, with the
   clock (22–7) as the fallback and the midday hint? Or should it simply be
   the clock?
3. Should the **night hours be editable** (start and end), or are two fixed
   choices enough for now?
4. Should arrow keys **play every sound** they pass, or choose silently and
   play only on Space/Enter?
