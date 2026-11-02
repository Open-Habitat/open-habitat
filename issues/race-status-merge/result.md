# Result: race group 1 (older status or reply overwrites a newer one)

Done 2.11. on Birch from `7b609ac0`, with the sweep instrumentation applied
locally only (reply delay 0–250 ms, `--repeat-each 2`, default timeouts, and
a second run with timeouts ×4), `OH_PORT_BASE=10900`, 6 workers.

## What was wrong, and what changed

Traced case by case with page logs; the sweep's grouping was from error
contexts, and several listed cases turned out to be other mechanisms.

1. **Status replies had no order.** `event_cursor` in a status is the Pi
   handle's own event counter; it restarts with every new handle (rest, wake,
   held start, daemon restart), so it cannot order replies. The daemon status
   now also carries `journal_cursor`, the journal position read under `c.mu`,
   under which the conversation's state changes and the events publishing
   them are made: a status reflects every event up to its cursor.
   `ConversationStore.applyStatus` drops a status read at an earlier position
   of the same daemon life, or from a life the stream or a snapshot has moved
   past, and returns whether it applied. This is the mechanism behind
   `status-stuck-working-after-release`: the view's refresh read applied
   unconditionally, so a read taken before the turn ended could land after a
   newer one and bring Stop back with no later event to correct it.
2. **The person's command was decided from whichever read landed last.** A
   steering message whose request was still on its way was marked uncertain
   by a status read that started before it existed, so its text came back
   into the field (queued-send `:599`). Now a command sent after a refresh
   began, or not answered when it began, stays pending; a module-level
   registry (`ownWrites`, `sentMessages.ts`) keeps the in-flight commands
   across remounts, and the host's answer is recorded in session storage
   (`…:answered:…`) even when the view is gone. Any applied status that names
   the command settles it (an effect in `useConversation`), not only the
   refresh's own read.
3. **A remounted view took an answered send for an unknown one** and put its
   text back into the field over the new draft (`:1517`, confirmed). It now
   resumes it as pending and reads its outcome.
4. **Stop pressed while a steering message was on its way was dropped**, or
   cleared Pi's queue before the message reached it (the daemon refuses
   `clear_queue` while a command is pending). Stop now records the press and
   an effect runs it once the message is answered and taken.
5. **A turn seen ending through a status read was not remembered as seen**
   when its `turn.settled` event arrived after the person left
   (rail-turn-returns `:34`). A shown conversation's applied status with a
   settled reply now marks it seen, ordered against the event that names it.

Pinned in Vitest with a controlled order: `conversationStore.test.tsx`
("status reads that come back in either order", and "remembers a turn seen
ending through a status read") and `ownCommand.test.tsx`, which drives the
real hooks with a transport the test steps. Each fails without its fix
(checked by disabling it). Go: `TestConversationStatusCarriesItsJournalPosition`.

## Spec changes and why

- `browser-conversation` `:488` (×3), `:684`, `:900`, `:1594`, `:1938`,
  `:2486`, `:2701`, `:2756`: wait for the opened conversation
  (`readyConversation`) before sending. Under delay these sent from the
  creation view, whose field is enabled before the controller exists; that
  message is held for the new conversation (another path, covered by
  queued-send's creation cases), so the case never tested what it names.
- `:1407`: the same after `goto(firstURL)`: leaving the loading view before
  its first reads end makes the return read again, which is not a warm
  return.
- `:1938`: wait until the tab knows the send's outcome before the restart; a
  restart that takes the only record leaves it unknown, which is the
  "receipt lost on daemon restart remains unknown" behaviour.
- `:1998`: wait for the archive write's answer before a document load; the
  load cancels a write on its way.
- rail-turn-returns `:34`: wait for the agent's answer before leaving; a new
  conversation's ball is "done" before the turn starts, so the spec could
  leave before the answer existed, and then the answer is rightly news.

## Counts (failures / runs)

| Case | Before D250 | After D250 | After D250×4 |
| --- | --- | --- | --- |
| browser-conversation :488 (×3) | 2/6 | 0/6 | 0/6 |
| :684 | 1/2 | 0/2 | 0/2 |
| :900 | 0/2 | 0/2 | 0/2 |
| :1011 | 0/2 | 0/2 | 0/2 |
| :1140 | 1/2 | 0/2 | 0/2 |
| :1407 | 2/2 | 0/2 | 0/2 |
| :1517 | 2/2 | 0/2 | 0/2 |
| :1594 | 0/2 | 0/2 | 0/2 |
| :1938 | 1/2 | 0/2 | 0/2 |
| :1998 | 0/2 | 0/2 | 0/2 |
| :2395 | 0/2 | 1/2 | 1/2 |
| :2486 | 2/2 | 0/2 | 0/2 |
| :2701 | 2/2 | 0/2 | 0/2 |
| :2756 | 1/2 | 0/2 | 0/2 |
| queued-send :170 | 2/2 | 2/2 (group 2) | 2/2 |
| queued-send :599 | 2/2 | 0/2 | 0/2 |
| queued-send :617 | 0/2 | 0/2 | 0/2 |
| rail-turn-returns :34 | 2/2 | 1/2 (`ERR_TOO_MANY_RETRIES`, group 9) | 0/2 |
| lab-conversation :1308 | 2/2 | 0/2 | — |
| Total | 24/44 | 4/42 | 3/40 |

The D250×4 column ran before the two review fixes (deferred Stop's same-commit order, lagging `turn.settled`); the D250 column is the final tree. An earlier D250 run of the final tree before the review fixes had `:1998` fail once on axe contrast during the 220 ms fade (group 8) and rail-turn-returns pass.

Line numbers are the sweep's (main `df02b6db`); the specs moved slightly.
Unloaded, the touched and affected specs pass: browser-conversation 78,
queued-send 13, next-waiting-row 4, rail-turn-returns 1, lab-conversation 14.
next-waiting-row under D250 ×3: 12/12.

## Not group 1 (left for their owners)

- **queued-send `:170`** (group 2): after the reload the person types into
  the loading view's field, which does not wake a resting Pi; the wake
  intent is lost. For `race-input-before-ready`.
- **queued-send `:491`** is group 2 as the sweep's table says (Enter in the
  loading view).
- **The creation view's send** (`:488`, `:2756` before the spec change): a
  message sent there is held, and its uncertain outcome is drawn as a
  waiting card ("Toimitus epävarma"), while the opened view draws the
  uncertain card that gives the text back. The same outcome is drawn two
  ways; that is the loading/opened composer split of group 2.
- **`:1998` axe** after the spec change: contrast read during the 220 ms
  fade, group 8 (seen once).
- **rail-turn-returns `:34`** once: `page.goto` failed with Chromium's
  `net::ERR_TOO_MANY_RETRIES`, group 9.
- **`:2395`** (changed snapshot identity): fails on the unchanged tree too
  (1/8 and 1/3 here; 1/2 in the sweep): the Tiedot popover holding
  `conversation-recheck` detaches before the click, or the second tab's
  account menu does not answer in time. Not a status order; a lead is the
  open effect in `useConversation` running again and calling
  `setDetails(false)`.

## Review

Independent `/llm-review` (finder gpt-6-astra, verifier claude-fable-5-1)
and `/assess-findings`: two confirmed findings, both fixed here (a Stop
run in the same commit as the settle effect skipped the queue clear
because that render's guards still saw the command outstanding; a lagging
`turn.settled` replaced a newer reply a status had named). One dropped
(rule 1b): Stop still aborts when an earlier send is genuinely uncertain
and the clear is skipped, which is existing behaviour.

## Decisions for later review

- **A new status field rather than reusing `event_cursor`.** Alternatives:
  order by the Pi counter (restarts with each handle, so a newer status after
  a wake would be dropped forever) or by the store's notification versions
  (only orders reads the store made itself). The journal position is the
  one clock events and statuses share.
- **A status from another daemon life is taken unless a stream event or a
  snapshot has moved past that life.** Two lives have no order of their own;
  retiring a life from a status could wedge a conversation if an old reply
  landed late. A late old-life status before the stream reconnects is
  therefore applied, and corrected by the restart's own re-reads.
- **Stop waits while the person's message is in flight or pending, without a
  timeout.** The daemon refuses both clear and abort while a command is
  pending, so running earlier fails anyway; the composer shows the stop in
  progress meanwhile.
- **The status-seen rule only marks seen, never raises attention**, so a
  status cannot make an old reply news.
- **`status-stuck-working-after-release`** was closed on main as
  cannot-reproduce (Jari 2.11.) while this ran; it stays so, with a note
  that the fitting mechanism (an unordered refresh read) is fixed here and
  pinned in Vitest.
