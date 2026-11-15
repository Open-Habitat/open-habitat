# Prototype round 1 — keyboard shortcut for moving between conversations (15.11.2026)

**Yhteenveto.** Kierros näyttää kolme näppäinvaihtoehtoa oikeilla
tuotantokomponenteilla. Näppäimet toimivat sivulla oikeasti, myös
kirjoituskentästä. **Suositus on 1 Suoraan: ⌥↑/⌥↓ (Alt+↑/↓) avaa sivupalkin
edellisen tai seuraavan keskustelun, ja ⌥⇧↓ vie seuraavaan sinua
odottavaan.** Se on Slackin ja Discordin tapa ja ainoa nuolipari, jota mikään
selain ei vie millään alustalla. Se jatkaa myös nykyistä ⌥↓-näppäintä.
Hinta maksetaan Macilla kirjoituskentässä: ⌥↑/↓ ei enää hyppää kappaleen
alkuun tai loppuun. ⌘K-vaihtaja on hyvä lisä myöhemmin. Toteutus on pelkkää
selainkoodia.

Round `design-system/prototypes/rounds/2026-11-15-rail-keyboard/`. Its
`NOTES.md` has every key Habitat binds today, the collision table
(Safari/Chrome/Brave/Firefox on macOS, Chrome/Firefox on Windows/Linux, the
composer, the terminal and the editor frame), comparable apps, the
discoverability plan and "What the host would need". The axis is **which key
moves between the rail's conversations, and whether it opens at once,
searches or browses first**. The view is the rail and the open conversation at
1440, keyboard-live. A review-bar toggle switches the key labels between
Mac and Windows/Linux, and another shows the Explain-mode sentence. There are
three themes, Finnish and English, and a 390 touch view where nothing changes.

- **1 Suoraan**: ⌥↑/⌥↓ opens the previous/next row in the visible rail order
  at once and keeps focus in the composer. ⌥⇧↓/⌥⇧↑ goes to the next/previous
  conversation in Sinun vuorosi. The Meanwhile row's key changes from ⌥↓ to
  ⌥⇧↓.
- **2 Vaihtaja**: ⌘K / Ctrl+K opens a type-to-filter switcher in rail order
  with section headings. An empty search preselects the previous
  conversation, so ⌘K Enter swaps between two. ⌥↓ stays the Meanwhile key.
- **3 Selaa ensin**: ⌥↑/⌥↓ moves keyboard focus into the rail onto the
  neighbouring row without opening it. Then plain ↑↓ browse, Enter opens and
  returns to the composer, and Esc goes back unchanged.

**Recommendation: 1 Suoraan.** It takes one key press from the composer, has
no mode to leave, and is the convention people already know from chat apps.
It also grows from the one rail key Habitat already has. Direction 2 is the
better tool once there are dozens of conversations, but Ctrl+K is the
address bar's search in every browser and kill-line in the terminal. It also
does not step through the list, which is what was asked for. Direction 3
avoids loading every conversation passed on the way, but it adds a mode with
its own keys, and the second press already reaches what direction 1 does in
one.

Checks: `check.mjs`, 151 checks, clean console. It covers every direction at
1440 in Päivä/Yö/Kontrasti and at 390 touch in Päivä/Yö, then presses the
keys: stepping, waiting jumps, drafts kept per conversation, the end of the
list, the switcher's open/swap/filter/Esc, rail browsing with Enter and Esc,
the picker not taking the arrows, the labels, the Explain card and English.
The page and screenshots are in the run's worker-results directory.

Live check: nothing changed on the test server. Open the round page
(`rail-keyboard.html`), click into the message field and try ⌥↓ ⌥↑ ⌥⇧↓ in 1,
⌘K in 2 and ⌥↓ ↓ Enter / Esc in 3.

## Decisions for later review (round 1)

- **Alt+Shift jumps to the waiting conversations, not between sections.**
  Alternative: first row of the next section (Sinun vuorosi / Käynnissä /
  Hiljaiset). Waiting-for-you is the jump people need, it is Slack's and
  Discord's "unread" key, and it absorbs the Meanwhile row's job.
- **Direction 1 moves the Meanwhile key to ⌥⇧↓.** Alternatives: keep ⌥↓
  meaning "next waiting" while the row shows. That makes one key mean two
  things depending on a row that comes and goes. Or drop the row's key.
- **Up/down only, no wrap at the ends.** Left/right are back/forward on
  Windows/Linux and word motion in the composer. Wrapping would send a held
  key round the list forever.
- **Steps follow the visible rail order**, including Hiljaiset when it is
  unfolded. Alternative: only Sinun vuorosi and Käynnissä. The visible order
  is the only one a person can predict from the screen.
- **Each step opens the conversation at once (1).** Alternative: 3's browse
  first. Opening is what was asked for, and a cancelled history load is
  cheap.
- **The terminal and the editor keep their keys.** Alt+↑↓ and Ctrl+K go to the
  shell (tmux and readline use them), and nothing is forwarded from
  code-server, where Alt+↑↓ moves lines.
- **The first-use tip appears after three mouse switches** and is
  dismissed for good. Alternatives: always-visible key caps in the rail
  (noise), or no tip at all, leaving only the Meanwhile row and Explain mode.
  The page shows the tip on load so it can be reviewed.
- **Not checked in this round:** whether Safari takes ⌘K, and Firefox's
  handling of Alt+↑↓ on Linux. `NOTES.md` marks these "?".
