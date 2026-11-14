# Load flakes: result

## First turn followed before history: product race, fixed

**Cause.** A new conversation whose cold status reports native history as
present opens its window in state `loading`. The opened view (and with it the
live turn) waits for the first tail read. During a running turn the journal
invalidates several times a second, and every snapshot that discharged an
invalidation ran `ConversationStore.reconcileStale()`, which bumped the epoch,
cancelled every pager read and began the first read again. A read slower than
that cadence never finished: 1.2 s in the spec, about 1 s on a loaded host.
So the window stayed behind the `conversation-loading` notice for the whole
first turn and only showed the work after the turn ended. The folded-work
summary that history then shows is short, so the spec's "stream taller than
two views" predicate never held.

Evidence (synthetic lab host, under load): a 100 ms DOM sampler in a failing
run showed `conversation-loading` from 0.4 s after Send until 10.3 s, when the
turn had ended. Console instrumentation in the store showed
`reconcileStale` → `loadTail` every 200–500 ms through the turn. The trace
had repeated aborted `history` requests and one successful read after the
turn. This explains the previous round's "conversation-loading while the
rail said working" snapshot, and why holding the turn longer did not help.

**Fix** (`web/src/app/conversationStore.ts`, `conversationPager.ts`):
reconciliation no longer cancels the first read of a window that is still
`loading` with no entries. It lets that read finish (`record.carried`,
`ConversationPager.cancelAll(keep)`) and reads the tail once more after it.
A reseed, a new daemon life and dispose still discard the read. Windows that
show content keep the old cancel-and-reread rule. The spec is unchanged.

**Counts** (`lab-conversation-scroll.spec.ts`, "first turn is followed"; two
workers, eight `timeout`-bounded busy loops, 250 ms reply jitter, seed
`r56-reds`, `OH_PORT_BASE=12100`):

| Code | Failed / executed |
| --- | --- |
| Before (this round) | 4 / 8 |
| Before (previous round) | 3 / 6 |
| First fix version | 0 / 30 (10 + 20) |
| Final (after the review fix) | 0 / 20 |

The whole scroll spec under the same load passed 12/12 on the final code.
Traces of the failing baseline and diagnostic runs are kept locally under
`/var/tmp/agent-keep/gate-load-flakes-bundle/r2/` (working evidence, not for
publication).

## Startup "Palvelin päivitettiin": instrumented, wording fixed

The original report describes a *full-page* notice after the first Send, with
`net::ERR_TOO_MANY_RETRIES` in the console. Only `ChunkLoadBoundary` replaces
the page. App's `checkBundle()` path shows a banner, and only while the page
is stale or offline. So the reported occurrence fits the preload path: a lazy
chunk that failed to load on a busy synthetic host. That path claimed a server
update without consulting the served index.

The boundary now:
- first shows a new `part-failed` notice ("Osa sivusta ei latautunut" / "Part
  of the page did not load"; reload; drafts are kept);
- runs `checkBundle()` and switches to `version-changed` only when the served
  index names another bundle;
- marks its result in `data-chunk-load-failed` (`checking`, `newer`,
  `current` or `unknown`), and writes one closed-field console line
  `[bundle] {"path":"chunk-load","asset":"/assets/…","release":…}`.

App's snapshot-failure path writes the same line with
`"path":"snapshot-failed"` when it finds a newer bundle. A future occurrence
can therefore be classified from the error-context snapshot or the trace
console. Under load, the `1440 light` skill-reader case passed 10/10 (seed
`skill-third`) on the new code. The previous round recorded 40/40.

## Not reproduced: closed without spec changes

| Case | Passed / executed | Round |
| --- | --- | --- |
| Skill reader, 1440 light | 40 / 40, then 10 / 10 | previous, this |
| Recap geometry journey | 6 / 6 | previous |
| rail-unread, quota-pressure, rail-archive, live-long-run, account-settings, workspace-slice | 81 / 81 | previous |
| Other lab-conversation-scroll cases | 12 / 12, then 12 / 12 | this |

Quota Escape already waits for focus inside the popover. No unrelated spec was
edited.

## Found along the way

Three `browser-conversation.spec.ts` cases fail deterministically on current
`main` too, without load. Filed unlaned as `unusually-spotless-pet`.

## Review

The store change was reviewed with an independent `/llm-review`: GPT-6 Astra
as finder (no findings), then Claude Fable 5.2 on one focused question about
the concurrency boundary. Fable found, and reproduced in a scratch test, a
sequence where the carried read's follow-up `reconnect` could leave the window
stale for good: native history gains an unstreamed entry before a streamed
one. Fixed by making the follow-up a tail read, and the regression test was
updated. The chunk-load change got focused self-review.

Checks run: `test-focused.sh --area web` (passed), and focused browser specs
`stale-tab-chunk-load`, `server-version-reload`, `lab-conversation-scroll`,
`lab-conversation`, `history-first-page`, `native-history`,
`new-conversation-placeholder`, `reconnect-paths`, `reconnect-recovery` and
`rewind-conversation`. All passed except the three main failures above.

## Decisions for later review

- **A loading window may show a page read before an invalidation.** The rule
  from 2 October 2026 was that no pre-invalidation page is ever published.
  For a window that shows nothing yet, that rule starved the first read on a
  loaded host. The page is now shown and a tail read always follows and
  replaces it. Alternatives: render the live turn while the window is still
  `loading` (changes what `opened` gates: header, composer, control), or keep
  cancelling and make reads faster (does not remove the starvation). The
  chosen change is the smallest. The brief flash it allows, an earlier prefix
  of history replaced moments later, is far less harmful than a turn hidden
  until it ends.
- **The chunk-load notice says what is known.** A preload error alone is not
  evidence of a release, so the notice says a part of the page did not load
  unless the served index changed. Alternative: keep "server updated" (true
  for the most common production cause, a release that removed old chunks).
  Rejected because the index check costs one request and makes the wording
  true in both cases.
- **The console line is always on, not opt-in.** It fires only when a reload
  notice appears, carries no identity or query, and a rare event has to
  classify itself without anyone having enabled a debug flag first.

Live check: open a new conversation on the test server while it is busy and
send a long task. The work should appear and follow as it streams, instead of
"Ladataan…" until the turn ends.
