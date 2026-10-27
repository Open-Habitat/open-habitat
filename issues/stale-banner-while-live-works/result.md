# Result

Run `01m5xxzq3zppps4s7a05g005fc`, on Birch, about ten minutes after the report.

## What the live evidence shows

Read with `sudo -n journalctl` for `open-habitat-gateway.service` and
`open-habitat-daemon@maintainer.service`, `http_request` records only. No
conversation content or credentials were read.

- Release `0.1.0-pilot.12` (`4c157a04`), installed 2026-10-26 15:42. Neither
  service restarted after 16:21 that day. The page was loaded at 07:02 on
  2026-10-27, so the tab ran the bundle of the release it was talking to.
- 07:30–07:45 (the report is 07:39): the gateway logged 190 snapshot reads
  completed with 200 and 53 `client_canceled`, and no `failed`. The daemon logged
  184 completed and 106 `client_canceled`, and no `failed`. The longest snapshot
  read took 1.55 s. For all of 2026-10-27, gateway and daemon have no
  failed snapshot read. Every `client_canceled` in that window is followed
  within 2.5 s by a completed read: those are reads the page itself
  superseded and aborted. Snapshots arrive in near-simultaneous pairs, which
  fits two open tabs.
- The event stream has no record at all. A stream is logged only when its
  response head takes over 250 ms or it fails with 5xx, so its absence is
  consistent with Jari's observation that the stream worked.
- The live snapshot validates against the browser's schema. I read
  `/api/v1/snapshot` as the gateway's UID over the daemon socket every 5 s
  for 5 minutes (60 reads, 26–58 kB). Every read was valid. The validator
  printed only `ok`, size and error paths, never values.
- Reads under 250 ms and 4xx answers are not logged. The gateway has no
  limiter on snapshot reads, and the daemon reads take ≥ 250 ms here, so a
  fast rejection that the log missed is unlikely.

**Cause.** No host component failed. The page counted one of its own snapshot
refreshes as failed. That can be a fetch that got no response, a session read
that failed, or a response the page rejected, and none of these leave a trace on
the host. The product then treated every such failure as a lost connection:
`fail("unavailable")` with a snapshot set the phase to `stale`. That showed
*Yhteys katkesi · tiedot voivat olla vanhoja* and made writes wait, even
though the event stream through the same gateway and daemon was open and
delivering the turn. A live turn refreshes at every interim reply, tool end
and final reply (about every 1–2 s in the log above), so even a rare failure
shows up during exactly the turns Jari is watching. **Which** browser-local
failure happened at 07:39 is not established: the host cannot see it.

## Fix

- `ConversationJournal.live()` tells whether an opened stream is following
  the daemon now. A dropped stream, a stream that is still connecting, and
  recovery all count as not live.
- `App.tsx`: if a background snapshot refresh fails while the stream is live,
  the phase stays `authenticated` and the page reads again after 2, 4, 6, …
  s (at most 15 s). A newer invalidation reads sooner and cancels the retry.
  If the stream is not live, the page goes `stale` as before.
- When the stream opens, a stale page returns to `authenticated` (`streamOpen`
  in the store) and reads the snapshot at once. Otherwise *Yhdistä*, which
  reopens the stream, could leave the banner up while the stream is back but
  the snapshot read still fails.
- Diagnostics: `[reconnect] {"event":"snapshot-failed","outcome":…,"live":…}`
  names the failed step: `network`, `status` (with the code), `invalid`,
  `session` or `other`. It never contains error text. Like the existing
  records, it is printed only when the tab has opted in with
  `sessionStorage["oh:debug-reconnect"]`. It is the missing evidence for
  the next occurrence.

## Tests

- New `web/tests/lab-snapshot-refresh-live.spec.ts`: a lab `hidas` turn in
  which every snapshot read from the interim reply to the final reply fails,
  in turn as a dropped request, a 503 and a rejected 200. The test records
  every connection notice and expects none. It also expects the page to read
  a good snapshot by itself afterwards. **Counterfactual:** with the live
  branch disabled the spec fails, recording eight `stale` notices. That is
  Jari's banner. With the fix it passes.
- Unit: `conversationJournal.test.tsx` "is live only while an opened stream
  follows the daemon".
- Changed expectations. Some cases built a "host outage" by failing only the
  snapshot route while the synthetic stream stayed open. That is the very
  case this issue makes silent. They now cut the stream too:
  `resilience-states.spec.ts` (helper `hostDown`/`hostUp`, six cases) and
  `browser-conversation.spec.ts` "snapshot transport failure leaves editor
  mounted and retry works". The case "expired session … during a snapshot
  outage" keeps the stream open, because its point is the stream's 401
  probe. It now expects no notice once the failed read has passed. In the
  synthetic host's fault scenarios (`malformed` and others) the event route
  answers 404, so the `malformed` step in "failed reads recover in place"
  still correctly ends stale.
- Passing: the web area (124 files, 780 cases);
  `lab-snapshot-refresh-live`, `lab-composer-live-focus` (desktop and phone);
  `resilience-states` (10/10); `@reconnect|cursor 409` (11/11). Also every
  other spec that fails the snapshot route (seven cases in `browser-editor`,
  `browser-conversation`, `refresh-identity`, `account-settings`, `rail-now`
  and `new-conversation-placeholder`). No whole-suite browser run.

## Review

An independent `/llm-review` (finder: GPT-6 Astra; one call; no verifier was needed)
found one real, bounded defect: `clearPerson` did not cancel a pending quiet
retry or reset its backoff. `loginFenced` already blocked any read, so the only
effect was a no-op re-render and a longer first backoff for the next identity.
The fix is in the follow-up commit, and `lab-snapshot-refresh-live` and
`refresh-identity` (6/6) were run again after it.

## Decisions for later review

- **A persistent snapshot-only failure is silent while the stream is open.**
  If every read keeps failing but the stream stays open, the page retries
  every 15 s without a notice. Conversation content stays current, but rail
  facts that only the snapshot carries can age. I chose this because the
  issue asks for the banner only on a real connection loss, and "Yhteys
  katkesi" would be untrue here. A quieter "tiedot voivat olla vanhoja" hint
  would need a design decision.
- **A manual refresh that fails while the stream is open gives no feedback.**
  The refresh button reopens the stream, so usually the read fails while the
  stream is still connecting. Then *stale* shows briefly and clears when the
  stream opens.
- `lab-composer-live-focus` fails one read after the interim reply. With this
  fix that no longer causes a stale flip, so the spec no longer exercises
  the focus fix of `composer-focus-stolen-by-interim`. That fix still covers
  real stale flips (stream down). The spec still passes as a typing-through-a-turn
  check.
- The live cause is narrowed to "browser-local failure", not named. The next
  occurrence with the diagnostic enabled names it. If `invalid` shows up, the
  next step is to find which snapshot field fails the browser's schema
  during a turn. Live sampling did not find one.
