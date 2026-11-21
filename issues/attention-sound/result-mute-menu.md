# Attention sound, round 5: muting this device from the account menu

## Saatesanat

Tässä kierroksessa kokeillaan, miten tämän laitteen äänen saa hiljaiseksi
tilivalikosta. Valikko aukeaa sivulla itsestään. Kolme suuntaa: A lisää
valikkoon Äänet-rivin Teeman ja Agentin työn alle, B laittaa kaiutinpainikkeen
tilipainikkeen viereen ja C tarjoaa valikossa tunnin tauon kaikille
laitteille tai hiljaisuuden vain tälle laitteelle. Tilannevalitsimesta näkee,
miltä valikko näyttää, kun tämä laite on hiljaa, kun ääni on pois kaikilta
laitteilta Asetuksista ja kun Hiljennä yöllä on päällä ja on yö. Pääalueen
katkoviivakortti ei ole osa tuotetta. Se näyttää, soiko ääni tällä
laitteella ja puhelimessa, ja Agentti valmistuu soittaa äänen, jos tämän
laitteen kuuluu soida. Suosittelen A:ta. Se on sama rivi kuin Teema ja
Agentin työ, jotka nekin ovat tämän laitteen valintoja. Rivi kertoo ennen
painamista, että Hiljaa koskee vain tätä laitetta, ja mykistetty laite
näkyy pienenä merkkinä tilin kuvassa, joten mykistystä ei unohda päälle.

## Built page

`design-system/prototypes/dist/sound-mute-menu/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-sound-mute-menu/build.mjs`.
Sources and check commands are in the round's `NOTES.md`. `check.mjs`
passed 456 checks: three directions × four situations at 1440 and 390 px in
light and dark, each direction's flow with the keyboard, one phone flow,
English, and a clean console. Screenshots (not committed):
`/var/tmp/agent-keep/attention-sound-mute-menu/`.

## Axis and directions

Axis: **how close to hand "mute this device" is, and what it sits next to.**
All three show the same facts in the same situations.

- **A Rivi valikossa.** A Sounds row with `Soi | Hiljaa` below Theme and
  Agent's work. While it plays, the line under it says "Vain tämä laite",
  so the scope is clear before the press. Two presses on a desktop (menu,
  Quiet). No new chrome outside the menu.
- **B Kaiutin.** A speaker button beside the account button at the foot of
  the rail: one press mutes, another restores; the menu only shows the
  state. The fastest on a desktop, but it adds a permanent control to the
  rail for an occasional action. A speaker icon alone does not say "this
  device only", so the scope comes from a toast. Production's focus tooltip
  on the account button opens over it. On the phone the rail is a drawer,
  so it still takes two presses.
- **C Hiljennä hetkeksi.** `1 h` (every device for an hour) and `Tämä
  laite` (until restored) in the menu, and `Palauta` while quiet. It fixes
  the forgotten mute and covers the "in a meeting" case for every device
  at once, but it brings two scopes and a timer into one row. "1 h on
  every device" is a personal value written to the host, unlike the rest
  of the row.

Shared in every direction:

- **How the state reads.** The state line says the strongest reason this
  device is quiet: off on every device (Settings), quiet for an hour on
  every device (C), quiet on this device, or night. "Off on every device"
  disables the control and links to the sound settings. A mute on this
  device puts a small slashed-speaker mark on the account picture (in A
  and C; B's speaker is the mark) and adds the state to the account
  button's accessible name. Night and off get no mark: they are standing
  choices, and a permanent mark would turn into noise.
- **Quiet at night.** It follows the device's day/night appearance. A
  device unmute does not override it. Restoring the sound at night leaves
  the line at "Yö: hiljaa, kunnes laite vaihtaa päivään", and the review
  aid shows the phone quiet too.
- **Keyboard.** The menu opens with Enter, Tab reaches the row's buttons,
  Space or Enter presses them, and Esc returns focus to the account
  button. B's speaker is a normal Tab stop with `aria-pressed`.

## Recommendation

**A Rivi valikossa.** Theme and Agent's work already sit in the menu as
this device's choices (in `localStorage`), and a device mute is the same
kind of thing, so it belongs in the same row pattern. Nothing new appears
in the rail. The scope reads on the row before the press. The mark on the
account picture covers the main risk of a device mute, forgetting it is
on, without a timer. Keep C's `1 h` in reserve: if pilots ask for "quiet
everywhere for a meeting", it fits as a second segment or a Settings
choice, and it is a personal value stored with the other personal sound
choices.

## Storage (unchanged from round 2)

- This device's mute stays in `localStorage`, like the theme. The account
  menu and the Settings section read and write the same key, so the two
  places cannot disagree.
- C's hour would be one more personal field next to the attention-sound
  choices in `~/.config/open-habitat/preferences.json`
  (`"snooze_until": "<RFC 3339>"`), written through
  `/api/v1/account/preferences`. No authority moves.

## Decisions for later review

- **Opening the menu on load (prototype only).** Without it, A and C would
  look the same as today on the default view.
- **C's `1 h` is every device and `Tämä laite` is this device.**
  Alternative: both device-only. The brief asked to show "here only vs
  everywhere", and a meeting usually means every device at once.
- **Order of reasons:** off on every device > hour > this device > night.
  The line names the one that would still silence the device if the
  others were lifted, starting from the broadest.
- **No mark for night or for off.** These are chosen, standing states. A
  permanent mark would teach people to ignore it.
- **Unmuting the device does not override night.** Alternative: a device
  unmute at night means "play anyway tonight". I chose the simpler rule
  and asked below.
- **A speaker icon was drawn for the round.** Production `Icon` has none.
  An implementation adds `speaker` and `speakerOff`.

## Questions for Jari

1. **A, B or C**, or A now with C's `1 h` later if someone asks for it?
2. Should the **mark on the account picture** stay while this device is
   muted, or is the menu line enough?
3. At night, should **restoring the sound on this device** make it play
   tonight anyway, or does Quiet at night still win (as built)?
4. If the timed quiet comes: should **"1 h" quiet every device** (as in C)
   or only this one?
