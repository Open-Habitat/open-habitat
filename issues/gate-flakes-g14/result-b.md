# Result, part B (terminal selection, slow creation reply)

## `browser-shell.spec.ts:241` line 297: selection lost after restoring the panel

**Cause (test race, product behavior noted).** tmux answers every client
resize with a full redraw. That redraw turns mouse reporting off and on again
(`?1006l ?1000l ?1002l ?1003l … ?1006h ?1000h ?1002h`). xterm's
`onProtocolChange` handler calls `SelectionService.disable()` when reporting
returns, and that clears the selection. A probe of xterm resize, selection
and mode events showed the failing case: xterm resized to 9 rows, the Shift
drag's mousedown followed 4 ms later, and tmux's redraw arrived mid-drag and
cleared it twice. In passing runs the redraw arrived before the mousedown.
`toggleMaximize` only waited for the xterm row count to change, which happens
before tmux answers.

**Fix (spec).** The test counts resize frames sent on the terminal WebSocket
and the received frames that turn mouse reporting back on (`\x1b[?1000h`).
`toggleMaximize` then waits until the redraw for the latest resize has
arrived before the next selection.

**Verification.** Reproduced at line 297 (third selection) under five `yes`
CPU hogs plus the other run's load, with `OH_BROWSER_WORKERS=2`: 2 of 10
failed with `OH_REPLY_DELAY_MS=250` and 1 of 20 with `OH_REPLY_DELAY_MS=0`.
After the fix, under the same five hogs with `OH_REPLY_DELAY_MS=0` and
`--repeat-each 30`: 30 of 30 passed. The whole spec also passed once.
CPU throttle alone did not reproduce it (6 of 6 passed), because the race is
with the tmux and host side.

## `lab-slow-creation.spec.ts:4` line 51: "Response body is not available"

**Cause (test).** The spec already read the reply's body as soon as the
response arrived. That was the October fix in `3a62c09b5`, which assumed a
navigation dropped the body. The click only changes the client-side route,
and Playwright adds its "navigated away" hint to every
`Network.getResponseBody` error. Chromium can drop the body of a page
response before Playwright fetches it, and the delay between `loadingFinished`
and that fetch grows under load.

**Fix (spec).** A `page.route` handler takes the reply with `route.fetch()`,
records its status and body, and then fulfills the page with it. This is the
pattern `tests/archive-proof.ts` already uses. The test does not depend on
Chromium keeping the body. Every assertion stays: the deadline, the starting
state, the selected child, reload and the single POST.

**Verification.** I could not reproduce the original failure here: 30 of 30
passed under the other run's load (about 15–27) and 30 of 30 under four extra
hogs. After the fix, `--repeat-each 10` (all three surfaces) passed 30 of 30
with `OH_REPLY_DELAY_MS=250` and 30 of 30 under four hogs with
`OH_REPLY_DELAY_MS=0`. Because there was no local reproduction, the fix rests
on the mechanism, not on a before/after comparison. CPU throttle 4 brought out
other timing failures in this spec (the 4 s creation deadline and 5 s
expects). Those come from throttling without the stress script's
`OH_TIMEOUT_SCALE`, not from this race.

## Decisions for later review

- The terminal fix waits in the spec. The product could instead keep a
  person's selection across tmux's redundant mouse-mode reset, for example by
  filtering off/on toggles that end in the same state. A person only loses
  a selection if they start dragging in the moment between a resize and tmux's
  redraw, and filtering escape sequences changes terminal semantics, so I
  left the product alone.
- The redraw marker is `\x1b[?1000h` arriving whole in one frame. If tmux's
  output ever split it across frames, the wait would time out and fail
  visibly rather than hide a race.
