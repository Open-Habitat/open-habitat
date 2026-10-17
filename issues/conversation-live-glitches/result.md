# Result

Three live glitches, three causes, each with a lab reproduction that failed
before the fix and passes after it. Items 1 and 2 share most of their cause.

## Live evidence and its limits

Read on the test server over Fleetrepo's pinned root route (2026-10-17, release
`fe3f3ee8`): the gateway and `open-habitat-daemon@maintainer` journals from
14:25 to 15:00 UTC (17:25–18:00 Finnish time). These hold only metadata
(`http_request` route, status, timing). No conversation content, Pi session
files, snapshot bodies or browser data were read.

- No restart and no failed `/api/v1/events` request in the window. The gateway
  does log failing event-stream requests (for example 409 `cursor` refusals
  earlier the same day), so there was **no stream reconnect or cursor gap**
  that the host saw.
- The writes match Jari's account: `POST /api/v1/conversations` at 14:44:29,
  two sends at 14:44:31 and 14:44:32 (the B1/B2 messages held for a new
  conversation), later sends at 14:45:30, 14:46:59 and 14:51:42, a new
  conversation at 14:53:26 and its send at 14:53:44.
- Live reads are slow: `/pi/models` takes 2.9–3.5 s, `/onboarding/pi/status`
  1.6–1.8 s and `/pi/claude-login` 1.2–1.4 s. The mapped-socket snapshot
  measured 1.7 s in `reconnect-live-cause`. The browser's warning surfaces
  wait 800 ms before appearing (`live-turn-flicker`), so any intermediate
  "stale" state shorter than a read becomes visible live.

**Item 1 is not attributed live.** The journals do not record events, so they
cannot show that Jari's turn outgrew the live tail. The mechanism below fits
everything he described (a gap notice, a temporarily incomplete timeline, then
recovery by itself) and the journals rule out the alternative of a reconnect.
I did not read the session file to measure his answer's length.

## 1 and 2. Long turns: the gap banner and the "Tarkista keskustelun tila" flash

Jari's "vilahtelee tarkasta keskustelun tila" reads as the recovery button
**Tarkista keskustelun tila** flashing below the timeline, not the top-bar
status. It flashed together with "Historia on vanhentunut".

**Cause A, the live tail's frame bound.** The daemon flushes streamed text
every 50 ms and each flush took one of the turn tail's 128 frames, so after
about 6.4 s of continuous streaming the tail gave up: the daemon emitted
`snapshot.invalidated/ring_truncated` and **stopped publishing live deltas
until the message was saved**. A single delta over 4 KiB did the same. The
browser had the same bound: 128 fragments, one per delta. On either bound it
dropped the streamed text, marked the turn `truncated` (which shows
"Tapahtumia jäi väliin") and marked the history `stale` while it reread. An
agent starting a spinoff streams its long brief as tool-call arguments for
several seconds, which is why it showed when the second spinoff started.

**Cause B, Pi's own writes made the history stale.** Every native write
(`agent_start`, `message_end`, …) is announced as `source_changed`. The
browser marked the open history `stale` at once and read it again only after
the answering snapshot. With live latency (snapshot 1.7 s and history 1.2 s)
that lasts well past 800 ms, so the warning and the button flashed at the
start of a turn even with the text still on screen.

**Fix.**

- The daemon (`internal/daemon/events_linux.go`) extends the newest tail
  frame when a flush continues the same text block, keeping that frame's
  envelope (cursor, sequence, event id), up to 16 KiB per frame and the
  existing 128 KiB. Subscribers still receive every flush. A large native
  delta is split on a rune boundary. Only a turn beyond 128 KiB or 128
  structural frames still gives up its tail.
- The browser (`conversationEvents.ts`) merges a delta into the fragment it
  continues and keeps that fragment's id, which is the React item identity.
  Its 128-fragment bound now counts structure, and when that bound is reached
  it truncates honestly rather than keeping a turn missing a delta.
- `conversationStore.ts`: a history catch-up on a contiguous stream
  (`ring_truncated`, `process.notification`) keeps the live turn and reads
  quietly. A contiguous `source_changed` leaves the view as it is and owes one
  read after the snapshot (`sourceChanged`). `reconcileStale` also redoes any
  in-flight read it cancels. Only a read that fails or cannot be joined shows
  the history as stale. A real sequence gap is still stale at once.

**Evidence (synthetic, host-backed lab, live latencies injected).**
`web/tests/lab-long-stream.spec.ts` streams 200 words at 60 ms with history
reads held 1.2 s and snapshots 1.7 s, sampling every 25 ms.

- Original code: text visible about 7.3 s, then about 0.8 s of gap banner with
  no text, then about 1.5 s of banner, button and stale history, then 0.2 s
  of button and stale history before recovery (run-length summary printed by
  the spec).
- Old daemon with the new browser: the text freezes for 4.6 s (fails the
  stall check).
- Old browser with the new daemon: a stale and button flash at turn start,
  then the gap banner with no text for about 4.7 s (fails).
- Fixed: no gap banner, no button, no stale notice, and the text never
  shrinks. Passed 3 of 3 in a row.
- Unit tests: `conversationEvents.test.tsx` (400 deltas stay one fragment with
  a stable id; the structural bound truncates honestly),
  `conversationStore.test.tsx` (an invalidation keeps a ready view and reads
  after the snapshot; a failed read is stale; a gap is still stale; a process
  notification keeps the streamed text and joins history quietly). Go
  `TestLongStreamKeepsMergedTail` covers 400 flushes and a 10 KB multibyte
  chunk: no truncation, text intact, sequences ordered, frames ≤ 16 KiB, every
  flush published.

## 3. Queued handover and the "?" box

**Slow handover.** When Pi accepted the held messages, the receipt marked them
`delivered`, and `waitingMessages` dropped delivered messages at once, although
the hook's own comment said a delivered message stays until native history
shows it. The native message came later. The history read that the start
triggered was still in flight (1.2 s in the lab, longer live), so the native
`history.entry` waited behind it. The lab probe timeline: acceptance at 7.30 s,
bubbles gone at 7.33 s, the native user entry received at 7.87 s and drawn
only at 8.53 s when the read landed. Fix: a delivered message stays drawn
until native history shows it, or until 10 s after delivery. The review then
found that the 10 s grace restarted on every re-render; it now ends at an
absolute deadline.

**"?" box.** The **Prosessit ?** pill (its text is just `?`). After Pi starts,
its process extension loads after Pi already reports running, so for a while
the daemon truthfully answers `bridge_unavailable`. `queued-send-unreachable-notice`
hid that only while Pi was not running. `web/src/app/processWarmup.ts` extends
the hiding past the start until an inventory read after the start says
`available`, or 10 s. A conversation opened while Pi is already running is
unaffected, and interrupted processes still show.

**Evidence (synthetic, host-backed).** `queued-send.spec.ts`, with the same
injected latencies:

- "a waiting message stays until native history replaces it": the old code
  had 1.2 s with neither bubble nor native message; the fixed code has none.
- "a stopped conversation resumes on send without a process pill": with the
  strip wired to the old `notStarted` it showed the `?` pill for about 20 s
  (787 samples; fake Pi has no process bridge, so here it never becomes
  available). Fixed: no pill. The whole spec passed 10 of 10.
- `processWarmup.test.tsx` covers the latch, an inventory older than the
  start, a fixed deadline despite polling, and an already-running
  conversation. `heldMessages.test.tsx` covers the absolute grace with fake
  timers; that test fails on the code before the review fix.

The real Pi extension's load time is not measured here; the 10 s bound is a
judgement.

## Checks run (final tree)

`umask 077`, `TMPDIR=/var/tmp/oh-*`, `OH_PORT_BASE=27300`, shared Chromium cache.

- `./scripts/test-focused.sh --area web`: format, lint, typecheck, 217 unit
  and 154 component tests passed.
- `--area go --go-package ./internal/daemon`: passed (56 s). The first run
  failed `TestJournalOverflowResetAndWriterExit`, which forced overflow with a
  4097-byte delta, the behaviour changed on purpose; it now exceeds the byte
  bound.
- Full default browser suite: 233 passed, 2 skipped, 2 failed. Both pass
  alone. "warm controlled return reads neither status nor history" fails
  intermittently with an extra snapshot plus conversations read, and the
  unmodified base fails the same way (5 of 32 repeats on the base, 2 of 16 on
  this tree). "changed snapshot identity discards late previous status"
  intermittently misses its button on the base too.
- Full lab suite: 46 of 46 passed. `lab-long-stream.spec.ts` passed 3 of 3,
  and `queued-send.spec.ts` 10 of 10 after the review fix.
- The full clean gate was not run (not a worker precondition).

## Review

`/llm-review`: finder `gpt-6-astra`, verifier `claude-fable-5-1`, two calls.
The finder reported one finding and checked the daemon merge against snapshot
ordering and the quiet read paths without finding more. F1 (should-fix): the
delivered-message grace restarted on every re-render, so a bubble could stay
up to about 20 s. The verifier confirmed it (bounded, not indefinite); it is
fixed and tested. `/assess-findings`: 1 FIX, applied. Model-performance logging
(`/assess-models`) was skipped because that helper commits and pushes Fleetrepo,
which a worker must not do.

## Follow-up

Filed unlaned as intake `dreadfully-barbarous-war`: while a history read is in
flight the store queues all live events, so the stream pauses for the read's
duration (1.2 s in the lab) once per turn. That is older behaviour, outside
these three items, and the lab spec tolerates one such stall.

## Decisions for later review

- **The tail merges text rather than raising the bounds.** Alternatives: a
  larger frame count (still runs out on long answers) or publishing on after
  overflow (a view opened later would draw text that starts mid-sentence). The
  merge keeps the bounds and the contract; schema text stays ≤ 64 KiB because
  merged frames stop at 16 KiB.
- **A truly overflowed tail (beyond 128 KiB) keeps what is already shown, with
  no banner,** until the saved message replaces it. The text then stops
  growing; the alternative is today's banner with the text removed.
- **Native-write hints no longer show the history as stale while the stream
  is contiguous;** only a failed or unjoinable read does. Showing it at once
  was what flashed on a slow host.
- **A delivered held message is drawn with the same "Odottaa Pi:tä" bubble**
  until native history shows it (up to 10 s). No new "sent" state was added,
  to keep the shared Conversation component unchanged while other work edits
  it.
- **Process unavailability is hidden for up to 10 s after Pi starts.** The fix
  lives in the browser, like the earlier waiting-state fix, rather than the
  daemon reporting a "starting" reason; it stays out of `BackgroundStrip`,
  which another worker is changing.
