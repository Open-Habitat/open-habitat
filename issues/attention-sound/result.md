# Attention sound: implemented as the experimental feature `attention-sound`

## Saatesanat

Huomioääni on nyt tuotteessa kokeellisena ominaisuutena (Asetukset ›
Kokeelliset ominaisuudet › Huomioääni). Kun se on päällä, Asetuksissa on
Äänet-osio kymmenellä laatalla, tilivalikossa on tämän laitteen Äänet-rivi,
ja työtilan yläosassa on nauha, josta kuvake, nimi ja ääni vaihdetaan. Ääni
soi kerran, kun agentti vastaa tai kysyy ja keskustelu siirtyy Sinun vuorosi
-osioon. Keskustelu, jota katsot, on oletuksena hiljaa, ja yöllä on hiljaista
laitteen tumman tilan mukaan. Äänet syntyvät selaimessa samoista resepteistä,
jotka hyväksyit. Ne ovat bitilleen samat kuin kierroksella 5, eikä
repossa ole yhtään äänitiedostoa.

## What landed

- **Sounds** (`web/src/app/soundSynth.ts`): round 5's `struck` renderer and
  the ten accepted recipes (Kalimba default, Marimba, Vibrafoni, Tunnus puu,
  Pisara, Lasit, Tuulikello, Kuplat, Kulho, Jääpuikot), in both lengths.
  `soundSynth.test.ts` checks all twenty renders against the round's own
  SHA-256 fingerprints, and every one is bit-identical. A sound renders on
  its first play in roughly 10–40 ms and is kept for the page.
- **Emblems** (`web/src/components/SoundEmblem.tsx`): B Väreilyn muoto with
  the round 7 choices: Kalimba *Koko soitin*, Marimba *Laatat*, Vibrafoni
  *Värinä*, Lasit *Lasin reuna*, Kulho *Huojunta* and Jääpuikot
  *Helähdys*. Tunnus puu, Pisara, Tuulikello and Kuplat keep round 6's
  emblems. Each strike ripples while its sound plays, and nothing moves
  with reduced motion.
- **Engine and trigger** (`web/src/app/attentionSound.ts`): one sound when a
  rail row gets a new `readyKey`, which is a new agent reply (`reply:<id>`)
  or a question (`railNow.ts`). These rows stay silent: a new conversation
  the person opened, a raise, a read reply, the rows present at load or
  after a reconnect (a 4 s settle window takes them as the baseline), and a
  burst within 2 s across this browser's tabs. The silences, strongest
  first: off everywhere, then this device muted, then night (the device's
  `prefers-color-scheme: dark` while Hiljennä yöllä is on), then the
  conversation in view (selected, tab visible and focused, while the choice
  is Hiljaa). The first press on the page unlocks audio for later sounds.
- **Settings › Äänet** (`web/src/app/SoundSettings.tsx`, route
  `/settings/sounds`): Äänet Pois/Päällä, ten B Renkaat tiles without times
  (a press plays and chooses, arrows move the choice), Lyhyet/Pitkät,
  Keskustelu jota katsot, Hiljennä yöllä with the day or night note, each
  workspace's sound in a fixed-width menu with ▶, and this device's mute,
  volume and test sound. The section and its search hits show only while
  the feature is on. Kokeelliset has the switch as row `attention-sound`.
- **Account menu** (A Äänet-rivi): Soi | Hiljaa for this device under Teema
  and Agentin työ, with the state line under it (Vain tämä laite, Hiljaa
  tällä laitteella, Yö…, Pois kaikilla laitteilla). The mark stays on the
  account picture while this device is muted.
- **Workspace strip** (`web/src/components/WorkspaceStrip.tsx`): A Yksi
  rivi. Kuvake is the production icon editor stretched over its square, and
  its value says where the icon comes from. Nimi edits in place (B
  Paikallaan): Enter or a click elsewhere saves, Esc cancels, focus returns
  to Nimi. Ääni opens the picker, where a press chooses and ▶ listens,
  without times. While the feature is on, the head shows the icon as a
  picture only, and the rename pencil and the icon source line step aside.
- **Persistence**: the account preferences gained `sound` (`enabled`,
  `default`, `length`, `in_view`, `night`, `workspaces`) in the contract,
  the daemon and the browser. A write is one key: `{"sound":{"<choice>":…}}`
  or `{"workspace_sound":{"ws_…":"<id>"|null}}`. The daemon stores only what
  differs from the defaults, bounds `workspaces` at 32 entries, and its file
  and reply bound grows from 4 KiB to 8 KiB. When a workspace's first rename
  gives it its durable ID, its own sound moves with it.

## Decisions for later review

- **Sounds render in the browser from recipes; no audio assets ship.**
  Alternatives: Opus files generated at build time, or committed small
  files. The renderer is about 700 lines of plain arithmetic and renders a
  sound in tens of milliseconds. Keeping the recipes as the source means
  there is no binary in git, no build step, and a fingerprint test that
  proves the sounds are the ones Jari heard. Recorded in `web/AGENTS.md`.
- **What counts as "becomes ready":** a new reply or question key in Sinun
  vuorosi. A new conversation, a raise or a read reply never plays.
  Alternative: any entry into Sinun vuorosi. That would ring for the
  person's own actions.
- **"The conversation in view" means selected, the tab visible and the
  window focused.** A selected conversation in a background window plays,
  as the description promises (Soi, kun … Habitat on taustalla).
- **One sound per 2 s across this browser's tabs** (a localStorage claim).
  Two devices still each play, unless one of them is muted. Muting is the
  decided cross-device answer.
- **A 4 s settle after load or reconnect.** Replies that arrive within it
  are not news. Alternative: compare with a stored "last heard" mark. That
  would be a new browser store of conversation state.
- **Mute and volume live in localStorage** (`nah:attention-sound-device`),
  like the theme. Volume defaults to 70 %.
- **The account menu's state line has no link to Settings.** The Asetukset
  item is right below. Alternative: the round's inline *Ääniasetukset*
  link. A link inside the menu would need the menu to close and navigate
  by itself.
- **A tile chosen while another choice is saving waits for it.** Tiles stay
  enabled and keep focus. The other rows follow the existing pattern and
  are disabled while a write is in flight.
- **At most 32 workspace sounds.** A 33rd is refused like any write over a
  bound, and the Settings page shows the write error. Clearing one always
  works. Stale entries for removed workspaces are not pruned.
- **Kokeelliset's card picture is the generic caption picture.** No
  bespoke drawing was made for it.

## Checks

- Go: `./scripts/test-focused.sh --area go` for `./internal/daemon`,
  `./internal/uiroutes`, `./internal/gateway` and `./internal/experimental`
  all passed. New cases are in `TestAccountPreferencesHTTPBoundary` and
  `TestAccountPreferencesSound`.
- Contracts: `./scripts/test-focused.sh --area contracts` passed, with
  positive and negative sound replies and writes in `validate-contracts.py`.
- Web: `./scripts/test-focused.sh --area web` passed, 1983 tests, including
  the fingerprints, the trigger rules, `readyKey`, the settings index and
  routes, the Finnish scan and the explain-mode cards (M29, AS01–AS06).
- Browser: `attention-sound.spec.ts` (new) and `settings-search.spec.ts`
  (touched) with `OH_BROWSER_WORKERS=2 --repeat-each 3`: 24 passed. The
  spec covers the feature off, the strip and in-place rename, the picker
  with axe, Settings rows against the index with axe, the tiles and arrows,
  the length, the menu mute and its badge across a reload, off everywhere,
  and a real fake-Pi reply in another workspace playing that workspace's
  own sound once. `rail-icons-quiet.spec.ts` fails three cases the same
  way on unchanged main, so it was filed as intake `overly-available-card`.

- Review: an independent `/llm-review` (finder GPT-6 Astra, verifier
  Claude Fable) and `/assess-findings` ran, because the account preferences
  and daemon state changed. Three findings were confirmed and fixed in
  d3a38b63: a strip pick during an in-flight write was dropped; the sound
  move on first rename could overflow the 32-entry bound; and a reconnect
  after a quiet stale period could ring for replies that arrived offline.
  One was dropped: a refused in-place rename loses the draft, as the
  existing rename dialog does.

Evidence (not committed): synthetic-lab screenshots with offline HTML of
Settings, the strip, the picker, in-place editing and the muted account
menu, at 1440 and 390 px in light and dark:
`/var/tmp/agent-keep/attention-sound/shots/`.

## Live check

On the test server, turn on Asetukset › Kokeelliset ominaisuudet ›
Huomioääni. Then:

1. Asetukset › Äänet: press a tile. It plays and becomes Valittu.
2. Open a workspace. The strip shows Kuvake, Nimi and Ääni. Give the
   workspace its own sound.
3. Write to an agent in that workspace, and open another workspace while
   it works. The reply plays the workspace's sound once.
4. Account menu › Äänet › Hiljaa: the picture gets the mark, and the next
   reply stays silent on this device.
