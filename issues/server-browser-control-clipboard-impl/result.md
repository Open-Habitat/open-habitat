# Result: take control by clicking the canvas, clipboard both ways (Kehys)

Implemented direction 1 Kehys of round
`design-system/prototypes/rounds/2026-11-22-browser-control-clipboard/` with
the behaviour of `server-browser-control-clipboard` result.md and Jari's
decision of 22.11.2026. Still behind the `remote-browser` experiment. No
contract, daemon route, store or authority moved.

## What changed

- **Viewer** (`web/src/app/BrowserViewer.tsx`, pure parts in
  `browserInput.ts`, frame and clipboard popover in
  `components/ServerBrowser.tsx`): the live picture sits in a frame whose
  border is the turn (solid accent: you, dashed: agent); the left tab holds
  the turn and Done / Ota ohjaus / Peru, the right tab opens the clipboard
  popover. The old band is gone. The agent's request shows above the picture
  as its own words.
- **Taking control from the picture**: a click or key on the picture while
  the agent drives takes control. Agent idle: the click (primary mouse/pen)
  or the typed keys are replayed into noVNC after the grant. Agent mid-step
  (`agent_connected`, or a press under 2 s old): the click is consumed and
  asks *Ota ohjaus nyt / Ota, kun se on valmis / Peru*; Escape answers it.
- **Auto-return** after 3 idle minutes, with a countdown for the last 30 s
  and *Pidä ohjaus*, only while the agent has no open request.
- **Paste in**: Ctrl+V (⌘V on a Mac) is kept from noVNC without preventing
  the default, so the browser raises a trusted `paste`; its text goes to the
  remote clipboard and the remote gets Ctrl+V. The confirmation shows a
  character count, never the text. If no paste event arrives within 400 ms
  (Safari on a canvas), the paste field opens. The popover has *Liitä
  sivulle*, *Kirjoita näppäilyinä* (asks again before sending line breaks as
  Enter) and *Piilota teksti*.
- **Copy out**: a remote clipboard change is offered only within 2 s of the
  person's own Ctrl/⌘+C or *Kopioi valinta*; then `writeText`, else a *Kopioi
  koneellesi* button, else selectable text. Unasked remote copies are
  ignored.
- **⌘ → Ctrl** on a Mac: the ⌘ key never reaches the remote (noVNC would send
  it as Alt); ⌘+key goes as Ctrl+key.
- **Clipboard clear**: Done, auto-return and closing the sheet while in
  control send an empty clipboard to Xvnc first.
- **Host** (`internal/browserhost`): agent commands held while the person
  drove are answered on give-back with `PersonTookControl` instead of being
  replayed; the CLI reports `browser_person_took_control`. The mux refuses
  `Browser.grantPermissions` with any clipboard permission and
  `Browser.setPermission` for `clipboard-*` (also malformed params). Xvnc
  runs with `-SendPrimary=0 -SetPrimary=0`. The browser skill tells the
  agent not to use the clipboard and names the new error.

## Decisions for later review

- **Touch takeover consumes the tap.** Alternative: replay it. noVNC reads
  touches as gestures (drag, pinch), so replaying a lone tap is guesswork.
- **Modified keys, Tab and Escape do not take control.** Tab must still move
  focus and Escape close the sheet; a shortcut aimed at Habitat should not
  grab the browser.
- **The countdown is inside the 3 minutes** (return at 3:00, visible from
  2:30). Alternative: 3:00 + 30 s. "Returns after three idle minutes" stays
  literally true.
- **Typing as keystrokes accepts only printable ASCII, Enter and Tab.** The
  round assumed ä/€ work through Xvnc's dynamic keysyms; the real-runtime lab
  showed Chrome never produces them. Such text is refused with a pointer to
  paste. Filed the related canvas-typing defect as
  `server-browser-non-us-keys` (unlaned).
- **The remote clipboard is cleared on every give-back,** not only after a
  paste, and also when the sheet closes in control (the strip's give-back has
  no viewer to clear it). Clearing is cheap and the person's remote copies
  have already left by then.
- **`-SetPrimary=0` as well as `-SendPrimary=0`,** so pasted text lives only
  in CLIPBOARD, the one place the clear empties.
- **`Browser.resetPermissions` is not refused** (the sketch listed it): it can
  only return permissions to their defaults, never grant clipboard access.
- **Held commands fail at give-back, not at takeover,** so the agent still
  waits as the person was promised, then re-inspects.
- **Focus returns to the picture after Done,** so it is not lost to the
  document and typing there takes control again.
- **Ctrl+Shift+V is also the person's paste.** Plain-text paste is the same
  text here.
- **Explain mode explains a click on the picture as B04** (Take control)
  instead of taking control.
- **Not implemented: the prototype's "agent wants to continue".** The host
  has no such signal; the request text and Done cover the case.

## Verification

- Go: `./scripts/test-focused.sh --area go` for `./internal/browserhost` and
  `./internal/cli` (after rebasing on main with the visit-data landing):
  held commands answered in order with the error and never sent to Chrome,
  clipboard grants refused with the agent's own id and session while other
  permissions pass, CLI maps the error.
- Web: `./scripts/test-focused.sh --area web` (biome, tsc, 247 files / 2016
  tests), including `browserInput.test.ts`.
- Browser: `server-browser.spec.ts`, 7 cases, green, and 21/21 with
  `--repeat-each 3` (`OH_BROWSER_WORKERS=2`). The synthetic RFB server now
  records keysyms and pasted text and can push a remote copy, so the spec
  checks what reaches the remote end: click takeover delivers the click, the
  mid-step question consumes it (take now, take when done, Escape), key
  takeover replays keys, Ctrl+V sends the clipboard then Ctrl+V and the
  toast never contains the text, paste field, keystrokes (refused non-ASCII,
  Enter after a second press, never the clipboard), unasked remote copy
  ignored, asked one reaches the local clipboard, every give-back clears,
  idle return with `page.clock` and none while asked, phone width, axe.
- **Real runtime lab** (TigerVNC Xvnc 1.13.1 extracted with `dpkg -x`, not
  installed; Playwright Chromium 153 as Chrome; the synthetic host's
  `BROWSER_HOST_REAL_BROWSER`): UTF-8 paste with an emoji arrives exactly in
  the remote Chrome through the extended clipboard (notify, then Ctrl+V gets
  the new text), copy back via Ctrl+A/Ctrl+C reaches the local clipboard
  exactly, ASCII keystrokes arrive, and after give-back the remote's own
  Shift+Insert pastes nothing; with the clear disabled it pasted the old
  text. Evidence and the throwaway lab spec:
  `/var/tmp/agent-keep/server-browser-control-clipboard-impl/` (README.txt,
  logs; spec screenshots under `spec-screens/`).

## Not verified

- Real Safari and Firefox: whether ⌘/Ctrl+V on the canvas raises a paste
  event (the 400 ms fallback covers it if not), and whether `writeText` is
  allowed from the clipboard event's transient activation (the button
  covers it if not).
- A real Mac keyboard (⌘ mapping is unit-tested and not exercised by a real
  macOS browser).
- Touch devices and soft keyboards.
- A real installation; the lab ran Chromium for Testing, not Google Chrome,
  without a window manager, as the product does.
