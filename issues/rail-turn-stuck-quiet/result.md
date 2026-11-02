# Result

## Cause

Reproduced on the synthetic host. In a tab that stays connected the cycle
quiet → new turn → Sinun vuorosi → seen → Hiljaiset worked every time. What
failed was everything else: attention was tab memory raised only by the live
`turn.settled` event. A reload (including the app's own reload on a new
bundle), a tab or machine opened after the turn ended, and an event-stream
recovery that skipped the event all left the finished turn in Hiljaiset with
a green "done" ball, which is what the screenshot shows.

## Fix

- The daemon's branch scan (already run for live and resting conversations)
  records the branch's last message when it is the model's finished answer;
  the snapshot carries it as `last_reply {id, at}` (contract change).
- The browser keeps, per web identity in `localStorage`, which reply of each
  conversation the person has seen here, plus a first-look horizon
  (`web/src/app/replySeen.ts`). A snapshot whose `last_reply` is unseen and
  newer than the horizon raises attention; the live event is keyed by the same
  reply ID (`turn.settled` `native_key`), so a later snapshot does not raise a
  turn already seen.
- Seen in one tab, a reply is seen in the browser's other tabs (`storage`
  event).

Tests: `TestSnapshotNamesTheLastFinishedReply` (daemon), "finished turns the
person has not seen" (store, two cycles plus reload and cross-tab), and
`web/tests/rail-turn-returns.spec.ts` (two cycles with the turn finishing on
another browser context, a reload and a later tab). `rail-unread.spec.ts` and
`next-waiting-row.spec.ts` now write their replies from another browser
context: with browser-wide seen state, a same-browser writer tab that shows
the reply has seen it.

Review: independent `/llm-review` (finder GPT-6 Astra, verifier Claude Fable
5.1) and `/assess-findings`. Three ordering defects in the browser's seen
logic were fixed with store tests: a settle event arriving after another tab
had already shown the reply, a stale tab overwriting a newer seen reply, and
a snapshot older than a settle event naming the previous reply. Accepted: two
tabs writing the seen record in the same instant can lose one mark across
renderer processes; that conversation then asks once more after a reload.

## Decisions for later review

- **Seen state lives in the browser, per device.** Alternatives: a host-side
  per-conversation read marker (one "seen" for all machines), or keeping it
  per tab. Chosen: browser `localStorage`, like the account keys' seen marks.
  The host keeps no read store (a new store needs a concrete need, and this
  one would be a second truth about reading), and per tab was what broke. Cost:
  a reply read on the laptop asks once more on the phone.
- **A new browser's first look sets a horizon.** Replies that ended before it
  (snapshot `captured_at`) are not news there; otherwise a fresh device would
  fill Sinun vuorosi with every waiting conversation.
- **Seen in one tab is seen in the browser's other tabs.** Before, each tab
  kept its own; the old `rail-unread` spec relied on a second tab of the same
  browser. Reading in one tab and being nagged in another is noise.
- **A reply the person stopped (abort) or that failed is not `last_reply`.**
  A failure already stays in Käynnissä; a stop the person asked for is not news.
