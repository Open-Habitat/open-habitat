# Result

Three causes in our own follow/anchor logic, all fixed in
`web/src/app/useReadingPosition.ts` (new `useFollowLatest`, moved out of
`BrowserConversation.tsx`) and the stream CSS:

- **Overshoot, creep back, then a jump.** A reader who scrolled a little up
  from the end (under 60 px) still counted as "at the end", and the 650 ms
  intent timer then wrote `scrollTop = scrollHeight`, snapping them back.
  Every live fragment and resize also wrote `scrollTop` even when the view was
  already there; such a write ends the browser's elastic overscroll and
  momentum mid-gesture. Now a reader moving up near the end is reading, the
  timer only follows growth that the gesture actually skipped, and every
  follow/anchor write happens only when it moves the view (`scrollToEnd`,
  `restoreAnchor` with a 1 px threshold, nothing while Safari reports an
  overscroll). The stream also has `overscroll-behavior: none`, so it stops at
  its ends instead of stretching past them.
- **Bounce during live work.** At each turn's start and end a row of the live
  tail (32–42 px in the lab) disappears for 15–60 ms before its replacement
  renders. A following view was clamped up and pinned back down. The stream now
  keeps its height with an empty `::after` (`--ah-stream-hold`) until the
  content regrows; a hold that is not refilled within 2 s glides away in
  240 ms (instant with reduced motion). A drop larger than half the view is a
  replaced thread (a paged native window), not a rebuilt row, and is followed
  at once.
- **First turn not followed.** With a slow first native-history read, the start
  page stayed mounted above the live turn, and a view containing the start page
  does not follow, so the first turn grew out of sight. A live turn now ends the
  start page.

Composer growth: in Chromium, following and growing the field four lines kept
the last row on the field's edge in every frame, both before and after the
change; no separate cause was found. The new test guards it. If Jari still sees
it, it is likely Safari-specific or the intent-timer snap (now gone) coinciding
with typing.

## Evidence

`web/tests/lab-conversation-scroll.spec.ts` (5 cases) records the painted
frames: a ResizeObserver created in each frame is delivered after the app's own
and before paint. A sampler that reads after a task produced false positives,
because a task can run between a commit and the next frame's correction.

- Against the unchanged source: 4 of 5 fail (first turn not followed; bounces of
  42/32/42/12 px; wheel and touch scroll snapped back by 30/35 px). The composer
  case passes; it is a guard.
- With the fix: 15/15 over `--repeat-each 3` with 2 workers.
- Wheel goes through CDP `Input.synthesizeScrollGesture` (mouse). Touch uses
  `Input.dispatchTouchEvent` in a `hasTouch` context at 390×844 (the synthesized
  touch gesture did not scroll in headless Chromium). Elastic overscroll is not
  emulated on Linux Chromium, so `overscroll-behavior: none` and the
  overscroll guards are unverified here, as is Safari/WebKit (not installed on
  Birch).

## Checks

- `./scripts/test-focused.sh --area web`: passed (125 files, 795 tests).
- Browser specs touching scrolling: `lab-conversation-scroll`,
  `lab-open-at-end`, `thread-fill`, `lab-page-scroll-header`,
  `phone-composer-keyboard`, `lab-live-turn`, `lab-long-stream`: all passed
  with `OH_BROWSER_WORKERS=2`.
- Whole main browser suite (`--area browser`): 416 passed, 3 skipped. The whole
  lab suite was stopped by the conductor and is left to its run on integrated
  main.
- Review: focused self-review (web-only; no daemon, contract, session state or
  authority path changed).

## Decisions for later review

- **No elastic overscroll in the conversation** (`overscroll-behavior: none`
  instead of `contain`). Alternative: keep the native bounce and only stop our
  writes from cutting it. Chosen because the acceptance says scrolling must not
  pass the end; it also removes the iOS pull effect inside the thread.
- **Moving up within 60 px of the end stops following.** Previously anything
  within 60 px counted as at the end in both directions. Reaching the end
  (under 2 px, or under 60 px while moving down) still resumes following.
  Alternative: a smaller symmetric tolerance. Chosen because a reader moving up
  is reading, and the tolerance in that direction was the snap-back.
- **Hold for 2 s, then a 240 ms glide; no hold for drops over half the view.**
  2 s covers a native-history read on a loaded host (over a second on the test
  server). A permanent shrink (for example the working line going at turn end)
  now leaves blank space under the last row for up to 2 s before gliding,
  instead of moving at once. Alternative: hold until the reader scrolls or the
  next turn refills it (no movement at all, but lingering blank space).
- **A live turn replaces the start page.** Alternatives: keep the intro but
  allow following with it. Chosen because the intro above an agent's running
  work is stale once the person has sent a message.
