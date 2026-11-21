# Result: terminal settings page, prototype round 1

## Saatesanat

Tässä on päätteen asetussivu kolmena suuntana. Kopioi valitsemalla on nyt
tavallinen asetus ja oletuksena pois päältä. Sen rinnalla on kolme halpaa
ehdotusta, jotka on merkitty sivulla Ehdotukseksi: tekstin koko, kohdistimen
muoto ja se, kysytäänkö ennen usean rivin liittämistä. Ne valitsin, koska
jokainen on yksi xtermin asetus tai `BrowserShell`in jo olemassa oleva
haara. Kaiken muun, mitä pääte jo tekee itsestään, sivu kertoo
"Näin pääte toimii" -listassa eikä tee siitä asetusta: värit seuraavat
teemaa, osoitteet tulevat korttiin, historia on tmuxin ja Shift valitsee.

Suunnat eroavat siinä, missä sivu asuu. A on pelkkä osio Asetuksissa, B
pelkkä ratas päätepaneelissa ja C molemmat: osio alkaa elävällä
esikatselulla, ja paneelin ratas vie sinne. Suosittelen C:tä. Kokeile
esikatselussa ensin valintaa Kopioi valitsemalla pois päältä ja sitten
päällä, ja vaihda tekstin kokoa. Työtila ja pääte -näkymässä samat
asetukset vaikuttavat paneelin päätteeseen.

## Axis and directions

Axis: **where the terminal settings live.** The content is identical in all
three.

- **A Osio** (Settings section): Settings › Pääte, an ordinary section after
  Editori. Nothing new in the terminal panel. Default view: Settings ›
  Pääte.
- **B Ratas** (gear in the terminal): a gear in the panel's tool row opens
  the settings over the terminal (a bottom sheet on a phone). A change shows
  in the terminal behind at once. Settings › Pääte only points to the gear.
  Default view: the workspace with the gear's dialog open.
- **C Esikatselu** (section, preview and gear): Settings › Pääte as in A,
  opening with a live preview terminal where selecting and text size can be
  tried. The panel's gear navigates to this section; there is no second
  settings UI. Default view: Settings › Pääte with the preview.

## Content (all directions)

| Row | Values | Default | Status | Stored |
| --- | --- | --- | --- | --- |
| Kopioi valitsemalla | Pois / Päällä | Pois | exists (experimental `terminal-copy-on-select`) | account, all devices |
| Tekstin koko | Pieni 11 / Normaali 12.5 / Iso 14 px (phone 10.5 / 12 / 13) | Normaali | proposal: xterm `fontSize`, today fixed | this browser |
| Kohdistin | Laatikko / Alaviiva / Pystyviiva | Laatikko | proposal: xterm `cursorStyle`, today default block | account |
| Usean rivin liittäminen | Kysy ensin / Liitä heti | Kysy ensin | proposal: today always asks (`askPaste`) | account |

"Näin pääte toimii" (facts, not settings): colours follow the Appearance
theme, with a link to Ulkoasu; a program opening a web address gets the
address card (`terminal-open-urls`, graduating); the wheel scrolls tmux's
history, whose length is tmux's own `history-limit`; hold Shift to select
when a program uses the mouse.

Settings search gains the section's four rows; Kokeelliset loses the copy
on select and open-URLs rows.

Considered and not offered:
- **tmux mouse.** Habitat sets `mouse on` per session
  (`internal/daemon/terminal_session_linux.go`), and wheel scrolling and
  the history view depend on it. A switch would break them.
- **Scrollback length.** xterm's 1000 lines do not matter, because the
  history is tmux's. The native setting is `~/.tmux.conf`, and Habitat
  should not keep a second one.
- **Own terminal theme.** The terminal is on the design tokens and follows
  the three themes. A separate palette would bypass the design system.
- **Bell.** Today nothing happens on BEL, and there is nothing to configure
  yet (see questions).
- **Clickable links in output.** This needs `@xterm/addon-web-links`, a new
  dependency, so it is listed as a question, not a row.
- **Cursor blink.** It stays on; a fourth row for it did not earn its place.

## Recommendation

**C.** The settings get one home that the settings search finds and that
sits where other per-person settings sit. The gear is where a person
notices they want a different text size, and it costs one icon button that
navigates. No second settings UI has to be kept in step. The preview lets a
person judge size and cursor, and try copy on select, without leaving
Settings. If the preview feels like too much, A plus C's gear is the cheaper
fallback.

B was the most direct to use: the change shows behind the dialog. But it
makes the terminal panel the only door, the settings cannot be found by
searching Settings, and the panel grows a second settings surface.

## Host assumptions

- Copy on select moves from `experimental` to an ordinary account preference
  (`contracts/v1/account-preferences.schema.json` gains e.g.
  `terminal_copy_on_select`, default false). The same goes for cursor and
  paste if they are accepted. This is a contract change but no authority
  change: the daemon already stores the person's own preferences.
- Text size is stored in the browser (like the theme), not on the host.
- `TerminalSurface` gains `fontSize` and `cursorStyle` props. C's preview
  is a second `TerminalSurface` writing a fixed synthetic sample; it talks
  to no host.

## Decisions for later review

- **Text size stored per browser rather than per account.** The alternative
  was per account. Screens differ (laptop vs. external display), and the
  theme already sets the per-browser precedent.
- **Three sizes rather than a slider or pixel field.** The alternative was a
  number input. Three steps cover the real need and keep the row
  consistent with other Segmented settings.
- **The paste question stays on by default.** Several pasted lines can run
  several commands. Turning the question off is the person's choice.
- **The open-URLs card has no setting.** Jari graduated `terminal-open-urls`
  to always on (`graduate-experimental-features-1121`), so the page only
  explains it.
- **The section sits after Editori, with the `terminal` icon.** The
  alternative was inside Ulkoasu. The terminal has its own behaviour
  (clipboard, paste), not just looks.

## Questions for Jari

1. C, A or B? And should C keep its preview, or should it be A plus the
   gear?
2. Are the three proposals (text size, cursor, paste question) welcome, or
   should the page start with copy on select alone?
3. Should text size follow you to every device instead of staying in one
   browser?
4. Clickable links in terminal output (Ctrl/⌘-click, through a new xterm
   addon): worth a row or a separate issue?
5. The bell: leave it silent, or offer a brief flash of the panel or the
   tab as a proposal later?

## Evidence and build

- Round: `design-system/prototypes/rounds/2026-11-21-terminal-settings/`
  (`NOTES.md` has the build and check commands).
- Built page (kept outside the worktree):
  `/var/tmp/agent-keep/terminal-settings-page/terminal-settings.html`.
- `check.mjs`: 337 checks passed. It covers 1440 and 390 px in Päivä, Yö
  and Kontrasti, the flows at 1440 Päivä, English, a phone flow in B, and a
  clean console.
- Screenshots: `/var/tmp/agent-keep/terminal-settings-page/check/`. None
  are committed.
