# Result: Latin characters reach the server browser

Finnish canvas typing and **Kirjoita näppäilyinä** now deliver ä, ö, å, € and
@, including into a password field without using the clipboard. The startup
map covers printable ASCII, Latin-1, Latin Extended A/B (U+00A0–U+024F), euro,
Enter and Tab. Unsupported keystroke text is still refused as a whole, with a
message saying nothing was sent; the paste suggestion is for ordinary text.

**No core runtime closure change.** No package, archive or dependency pin was
added. `/usr/bin/xkbcomp` and the system XKB data already arrive through
TigerVNC's mandatory `x11-xkb-utils` and `xkb-data` dependencies. The keymap is
embedded in the product binary. An already-running server browser needs to be
closed and started again after upgrading to get the new startup map.

## Root cause and implementation

TigerVNC allocates a missing keysym dynamically and sends XKB map-change
notifications. Chrome's X11 keyboard cache refreshes on core MappingNotify or
XkbNewKeyboardNotify, not that XkbMapNotify. The late symbol is therefore
absent from Chrome's map. Source inspection: TigerVNC 1.13.1
`vncInputXKB.c::vncAddKeysym`, Chromium `ui/gfx/x/connection.cc` and
`keyboard_state.cc`; the original real-runtime reproduction established the
observable loss.

The host now loads a fixed embedded keymap through a five-second, same-UID
`xkbcomp` invocation after Xvnc starts and before Chrome starts. `-noreset`
keeps it when the loader disconnects. Failure prevents Chrome startup and
reports a fixed diagnostic, without raw subprocess output. No listeners,
identity choices, authorization rules or browser contract changed.

High keycodes have an ASCII base symbol: without one Chrome falls back to
hardware key meanings and some letters become Back/Refresh actions. Reserved
modifier keycodes remain untouched. Literal four-level keys consume Caps Lock;
otherwise TigerVNC can fail to find the requested literal and allocate another
invisible dynamic symbol. Ordinary US letter keys retain alphabetic Caps Lock.

Text conversion now shares noVNC's pinned canonical keysym lookup: euro and
older extended Latin letters have legacy X11 keysyms, not simply a Unicode
prefix. The full-repertoire lab also found noVNC 1.7.0 maps small o with caron
(U+01D2) to capital O. A narrow correction to the shared lookup fixes both
canvas and field input; a native canvas assertion covers it.

## Decisions for later review

- **One broad startup map, no person-specific layout setting.** The local
  browser already resolves the person's characters. A Finnish-only map or a
  layout selector would leave other Latin keyboards broken or require setup.
  Supported range is explicit; this does not claim every Unicode script.
- **Load with xkbcomp before Chrome.** The shipped Xvnc has no usable
  `-xkbmap` startup option. A stock US international layout covers fewer
  symbols than the fixed map. The loader is already an OS dependency.
- **Do not force noVNC out of QEMU mode.** TigerVNC's
  `XserverDesktop::keyEvent` discards physical keycodes when RawKeyboard is
  false, its default here. An experimental client adapter was removed as
  unnecessary; final native tests use the original noVNC construction.
- **Do not synthesize keymap-refresh notifications per character.** Chrome
  does refresh on some notifications, but TigerVNC's dynamic path emits a
  different one. Preloading avoids a new event bridge and timing race.
- **Keep refusal for emoji, combining marks and characters outside the
  supported range.** Do not silently route password text through clipboard.
  Composed Latin characters in the supported range work.
- **Keep a trusted loader seam only for the existing headless CLI test.** Its
  fake display has no X server; it uses `/usr/bin/true`. Production exposes
  no override flag and always defaults to the fixed system loader.

## Verification

Tested implementation: `a5bb4148` (the final code checked before the
result/issue-only commit).

- `./scripts/test-focused.sh --area go`: passed for all Go packages, with
  `OH_BROWSER_ACTION_CHROME` enabling the existing native CLI fixture through
  the disposable Chromium wrapper. This also verifies the repaired fake-display
  fixture. It is not Chrome sandbox qualification.
- `./scripts/test-focused.sh --area web`: passed, 248 files / 2023 tests,
  including canonical keysyms and unsupported-text refusal.
- Focused `server-browser.spec.ts`: 7/7; named Playwright repeat run with
  `--repeat-each 3`, `OH_BROWSER_WORKERS=2`: **21/21**. It checks non-ASCII
  keysyms reach the RFB peer and no clipboard write accompanies typing,
  unsupported text sends nothing, plus existing control/clipboard journeys.
- Focused `server-browser-keyboard-native.spec.ts`: passed; named repeat run
  with `--repeat-each 3`, one worker: **3/3**. Real extracted TigerVNC
  1.13.1, Playwright Chromium 153, production host and viewer, synthetic local
  page and password. Finnish physical-code events and AltGr output arrive;
  the password field receives exact text; all 433 extra supported characters
  arrive with Caps Lock both off and on. The fixture orders its observations
  by sequence, not HTTP completion order.
- Review negative experiment: with the original FOUR_LEVEL type and Caps Lock
  on, `äÄǒǑ` became `ǒǑ`. The corrected type passes the complete repertoire.
- `git diff --check`, `issuectl doctor --json` and
  `python3 scripts/validate-project-view.py`: passed.
- No whole browser suite or clean gate was run, as requested.

Evidence remains outside git at
`/var/tmp/agent-keep/server-browser-non-us-keys/`: `go-final.log`,
`web-final.log`, `native-final.log`, `native-repeat.log`,
`browser-final.log`, `browser-repeat.log`, `caps-negative.log`, and review
outputs. `TESTING.md` documents the opt-in native command.

## Review and limits

Independent `/llm-review` (Claude Fable 5.2 finder, GPT-6 Astra verifier), then
`/assess-findings`: two confirmed code defects fixed (headless CLI fixture and
Caps Lock), plus the missing native test instructions added. No unresolved
finding or follow-up issue. Local assessment artifacts are
`history/review-server-browser-non-us-keys.md` and
`history/assessment-server-browser-non-us-keys.{json,md}`. Performance logging
was disabled for this no-push worker.

The real lab uses disposable synthetic profiles and a sandbox-disabled Chromium
wrapper, exactly as the earlier lab; it proves keyboard delivery, not sandbox,
Unix isolation or an installed deployment. Physical Finnish hardware,
Safari/Firefox, IMEs/dead-key composition and soft keyboards were not tested.
No required check or review remains blocked.
