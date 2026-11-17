# Attention sound, round 2: the personal default in Settings

## Saatesanat

Tässä kierroksessa on henkilön oma huomioääni asetuksissa. Asetuksiin tulee
uusi Äänet-osio Ulkoasun jälkeen. Siinä valitaan, soiko ääni ylipäätään,
mikä ääni, milloin (agentti valmis / kysyy) ja soiko se, kun keskustelu on jo
edessä. Lisäksi tällä laitteella on oma mykistys ja voimakkuus. Kolme suuntaa
eroavat siinä, miten ääni valitaan ja kuinka paljon näkyy kerralla: A
listaa kaikki äänet kuuntelupainikkeineen, B piilottaa ne valikkoon ja C
näyttää ne laattoina ja omat äänet kaaviona. Suosittelen A:ta, koska ääni
valitaan korvalla. Äänet ovat tarkoituksella paikkamerkkejä; oikeat
äänet tulevat rinnakkaisesta kierroksesta. Työtilan ja keskustelun omiin
ääniin osio vain viittaa, koska niiden näkymät ovat myöhempiä kierroksia.
Suurin avoin kysymys on, onko ääni oletuksena päällä vai pois.

## Built page

`design-system/prototypes/dist/attention-sound-settings/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-17-attention-sound-settings/build.mjs`.
Sources and check commands are in
`design-system/prototypes/rounds/2026-11-17-attention-sound-settings/NOTES.md`.
`check.mjs` passed: 1069 checks over three directions × six situations at
1440 and 390 px in light and dark, the click flows, English, console clean.
Screenshots (not committed): `/var/tmp/agent-keep/attention-sound-settings/`.

## Axis and directions

Axis: **how the default sound is chosen and how much of the setting is on
the first view.** All three show the same facts in the same situations.

- **A Lista.** All eight sounds as rows (two columns on desktop), each with a
  listen button; choosing a row also plays it. Events and the "conversation
  in view" rule in a card below. "On this device" (mute, volume, Test sound)
  and "Own sounds" each in their own card under a heading. Longest page,
  but nothing hidden, and every sound is one press away.
- **B Valikko.** One compact card: on/off, the default sound in a
  menu beside one listen button, events, the rule, then a band for this
  device and a one-line "2 workspaces and 1 conversation use their own
  sound · Show". Shortest; comparing sounds takes a menu open per sound.
- **C Laatat.** Sounds as tiles with a small drawing of the sound; a press
  plays and selects. Own sounds as a three-step diagram Default › Workspace ›
  Conversation, with the current examples, above the device card. The
  most visual and teaches overriding best, but the tiles are a new pattern
  in Settings.

Shared in every direction: the "sounds are placeholders" tag; listening
always plays, also when the sound is off or this device is muted, because it
is an explicit press; the browser's autoplay gate is said in words and
opened by Test sound; when the personal file cannot be read, the personal
choices are locked and the device's mute and volume still work; own sounds
link to the workspace menu or the conversation (a toast says those are later
rounds).

## Recommendation

**A Lista.** A sound is chosen by ear, so every sound should be one press
away and comparable without opening anything, and rows with a radio and a
play button are the Settings page's own language (s-card/s-row). Take one
idea from C into A later if the workspace round shows people miss the
override rule: the three-step Default › Workspace › Conversation line.

## Storage (proposal)

Two owners, two places (details in NOTES.md):

- **Per person, on the host:** on/off, default sound, events, the
  conversation-in-view rule → `~/.config/open-habitat/preferences.json`
  through the existing `/api/v1/account/preferences`, beside language and
  editor. They describe how the person wants agents to reach them and must
  follow them across devices, like language.
- **Per browser/device:** mute and volume → `localStorage`, like the theme.
  They depend on the device's speaker and situation; saving them per person
  would mute every device at once.

No authority moves: the person's daemon writes only the person's file, and
the browser's app layer plays the sound from conversation state it already
receives. No new contract endpoint, one new field in the preferences schema.

## What the view assumes from the host

- The browser can tell "turn ended, waiting for the person" and "agent asks
  a question or approval" from the snapshot/SSE it already has. Round 1
  (the sound set and when a sound plays) decides the exact events.
- Workspace and conversation sounds exist later and the Settings page can
  list them (name, sound or silent). Where they are stored is a later
  round's decision.

## Decisions for later review

- **Placement: a new Äänet section after Ulkoasu.** Alternatives: under
  Ulkoasu (appearance, not sound), under Kokeelliset (it is not
  experimental). A section of its own is findable from the sidebar and the
  search.
- **Default for a person who never chose: off.** Alternative: on. A sound
  that starts without asking surprises people in shared rooms; the pilot who
  asked can turn it on. Asked below.
- **Two events, both on once the sound is on:** "finishes" and "asks or
  needs permission". Errors are not a separate event; round 1 may change it.
- **"Conversation in view" default: not while I'm looking at it.** Plays
  when another conversation is open, the tab is in the background or the
  window is hidden. Alternatives in the menu: always; only when Habitat is
  hidden.
- **Listening and Test sound play even when off or muted.** They are
  explicit presses; otherwise a muted device could never preview.
- **Personal off silences own sounds too.** One switch means silence
  everywhere; the own-sounds list says so.
- **Volume is per device only.** A per-person volume would be wrong on the
  next device's speaker.
- **Read error locks the personal choices but not the device's.** The
  device's values are local and known.
- **Several tabs in one browser:** not shown. Proposal for implementation:
  only one tab per browser plays (BroadcastChannel), otherwise two tabs
  double the sound.

## Questions for Jari

1. Is the attention sound **on or off by default** for someone who has never
   chosen? I chose off.
2. Should **per-device mute** live here only, or also as a quick toggle
   elsewhere (account menu or the conversation header) for "mute this phone
   now"?
3. Is the **"conversation in view"** rule right as a personal setting
   (follows you everywhere), or should it be per device like volume?
4. **A, B or C** for the sound choice, or A with C's three-step override line?
