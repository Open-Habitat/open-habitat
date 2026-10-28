# Result

The gap was the hold from `conversation-scroll-overshoot-bounce`. When a
following view's tail shrinks, `useFollowLatest`
(`web/src/app/useReadingPosition.ts`) keeps the stream's height with an empty
`::after` until the content regrows or the hold expires. Two things kept it
on for the whole live turn:

- **Every resize restarted the expiry.** Any ResizeObserver callback, or a
  rerun of the effect when native rows arrived, that found the content still
  below the held height set the 2 s timer again. A live turn resizes its tail
  all the time, so the timer never ran out. In the lab, before the fix, the new
  test measured one stretch of 10.7 s with 27 px extra under the last row.
- **Most shrinks are not dips.** The live row changes its own shape while it
  works: in the lab it is 12 px shorter when the interim reply replaces the
  working body, 12 px shorter again when the native row replaces it at the
  end, and 10 px shorter when the receipt goes and the collapsed live row
  arrives. Those never regrow, so they were held for the whole window. The
  dips the hold exists for (a rebuilt row briefly missing at a turn's start
  and end) refilled within 15–60 ms in every lab trace, including with a
  1.2 s native-history delay.

Now the expiry is set once when the hold starts and is not renewed. The window
is 300 ms instead of 2 s, followed by the existing 240 ms glide. A lasting
shrink therefore leaves at most about half a second of extra space under the
live row, and it glides away instead of jumping.

## Evidence

- New case in `web/tests/lab-conversation-scroll.spec.ts`: "the live row stays
  at its spacing above the composer". It records painted frames through two
  live turns with slow native history. No stretch of frames may have more than
  the stream's design padding (22 px) under its content for over 700 ms, and
  the settled end must be at the padding. Before the fix it failed, with
  stretches of 10.7 s/+27 px and 2.2 s/+42 px. After the fix it passes.
- `tallAtEnd` in the same spec took a stable `scrollHeight` as a settled
  thread, but a hold keeps `scrollHeight` constant. Under the 2 s window the
  growing-field case recorded inside a still-standing hold. With 300 ms the
  hold's glide fell inside the recording and made it fail. The setup now also
  waits until no hold remains.
- Whole spec, `--repeat-each 3`, 2 workers: 18/18 passed, including the bounce
  case (no jumps, no gap at the end).

## Checks

- `./scripts/test-focused.sh --area web`: 128 files, 817 tests passed.
- Browser specs: `lab-conversation-scroll` (18/18 repeated), `lab-open-at-end`,
  `lab-live-turn`, `lab-long-stream`, `lab-page-scroll-header`, `thread-fill`,
  `phone-composer-keyboard`: all passed with `OH_BROWSER_WORKERS=2`.
- Review: focused self-review (web-only; no daemon, contract, session state or
  authority path changed).
- Unverified: Safari/WebKit and real Pi traffic (not available on Birch).

## Decisions for later review

- **Hold window 300 ms, not renewed.** Alternatives: keep 2 s but stop
  renewing (the gap would still show for 2 s after each status change of the
  live row), or tell live-row reshaping apart from a rebuild in
  `BrowserConversation` and hold only the latter (more coupling to how a turn
  settles, which another worker is changing). I chose the short window because
  every dip observed was under 60 ms and a lasting shrink should look like
  a short glide, not a gap. If a slow device shows the bounce again, raise the
  window, but keep the expiry set once per hold.
