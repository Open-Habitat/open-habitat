# Result

When a reply finishes, the reply card now stays the same element at the same place and size. The turn's working row ("Näytä työ · Agentti työskentelee"), the reply's finished state and the composer's Stop→Send change in one frame, whichever reaches the browser first: the saved reply or the status that ends the run.

## Measured before changing code

Synthetic lab, production bundle, `pi-deltas` scenario (a streamed reply with an interim message and one tool), 1440×900 and 390×900, CPU 4× and API jitter. The measured turn was the second one in a conversation; sampling started while its final reply streamed. Instrumentation: a `PerformanceObserver` for every layout shift (including recent-input shifts), a `MutationObserver` counting new reply, message, turn, composer, stack, field, send, header and stream elements and logging removed ones, animation-frame rectangles, and temporary render tracing in `BrowserConversationContent` (removed afterwards).

Three things moved at the handover, desktop numbers (phone was the same in kind):

| Time from final save | What moved | Cause |
| ---: | --- | --- |
| 0 ms | **The reply card itself reflowed**: height 145.6 → 133.6 px, text and header moved (shift sources `.ah-prose`, `header`) | A streaming reply got the `ah-message-alert` class as a side effect of its animated "replying" state, so it was drawn with the bordered alert-card geometry (padding `--ah-s5`, flex header). A finished reply uses the reply-card grid. Completing switched one for the other. |
| 0 ms | The working row was replaced by the stage summary row: 25.5 → 24 px, so the reply moved up 1.5 px | The two rows had different heights. |
| 0 ms → +90–110 ms | **The turn finished first and the composer later.** The working row disappeared and the reply showed as done, while Stop stayed on screen for one more status read. | Pi saves the final reply before its run settles. When that history read arrived, `timelineItems` stopped merging the live turn (`endsTurn`), so the turn was drawn as finished while `current.run_active` was still true. Stop→Send followed with the next status. Traced as `entries` +1 with the final, `liveItems` 0 and `runActive: true`, then `runActive: false` 90 ms later. |
| +200–300 ms | Rail row moved from its working group to the quiet group | Intended rail behaviour (it remounts in its new list); ≤0.004 shift. Not changed. |

No remount of the message, the turn, the composer or the top bar was found. The streamed reply was already the element that became the finished one (earlier `conversation-live-glitches` work).

## Fix

- `Conversation.tsx`/`components.css`: a streaming reply is no longer an alert card. It carries `ah-message-replying`, which shares the finished reply's header rules, so streaming and finished replies have identical geometry. Only the label and the check icon change.
- `components.css`: the working row is exactly as tall as the stage summary row that replaces it (min-height 24 px, 2 px block padding on the status).
- `HistoryView.tsx` `timelineItems(…, wasRunning)` / `BrowserConversation.tsx`: a turn that the last commit drew as the running turn stays running while the run's status says it runs, even after its final reply is saved. It is drawn from the saved steps only, because the streamed copy is that saved reply. "Drawn as running" is recorded in a layout effect. It means either the saved-history turn carrying the live tail, or (beside a readable history window) a live row whose turn history has not yet shown. That covers a first message's turn too. The turn therefore ends with the same status change that turns Stop into Send. A turn that was not running (for example the previous one, while a new turn's message is still unread) is never revived, and nothing is held once the status says the run is over.

## Verification

- New `web/tests/lab-turn-end-jitter.spec.ts`: desktop and phone × natural order and "history late" (history reads delayed 900 ms, so the status ends the run first). Each case asserts:
  - the streamed reply element is the finished one and never detaches;
  - zero new reply/message/turn/composer/stack/field/send/header/stream elements;
  - working row, reply state and Stop/Send switch in the same frame and never flip back;
  - the reply moves and resizes < 1 px;
  - the composer field moves < 1 px;
  - total layout shift < 0.05, recent-input shifts included.
- **Before the fix:** all four cases failed the single-switch assertion. **After:** 3 repetitions × 4 cases green, twice (with the first-message spec, `lab-live-turn` and `lab-turn-stages`: 24/24, then 36/36), 2 workers, `OH_CPU_THROTTLE=4`, `OH_REPLY_DELAY_MS=250`.

| Width / order | Total shift range (3 runs) | Reply movement | Remounts |
| --- | ---: | ---: | ---: |
| Desktop / natural | 0.00061–0.006 | 0 px | 0 |
| Desktop / history late | 0.00061–0.006 | 0 px | 0 |
| Phone / natural | 0.0004 | 0 px | 0 |
| Phone / history late | 0.0004 | 0 px | 0 |

  The remaining shift is the rail row changing group (desktop) and the copy button moving 2 px when the header gains its check icon.
- Vitest: `HistoryView.test.tsx` covers the hold, the saved-only steps, and the two non-holding cases (a turn not drawn running, a run that ended).
- `./scripts/test-web-fast.sh`: 229 files, 1,809 tests passed.
- Neighbouring browser specs (ordinary + lab, default jitter): `lab-live-turn`, `lab-turn-stages`, `lab-long-stream`, `lab-snapshot-single-flight`, `lab-composer-live-focus`, `lab-conversation-scroll`, `native-live-join`, `auth-failed-turn`, `turn-work-row`, `queued-send`, `live-long-run`, `turn-changes`, `browser-conversation`: 14 lab + 111 ordinary passed, 1 skipped (pre-existing skip).
- Not run: whole suites, the clean gate, a live installation, a real provider. Measurement JSON for baseline and fixed runs is kept locally under `/var/tmp/agent-keep/turn-end-jitter`, not in git.

## Decisions for later review

- **The run's status, not the saved reply, ends a turn on screen.** Alternative: switch the composer to Send as soon as history shows the final reply. That would move Stop/Send authority from the host's run state to a history heuristic, and offer Send while Pi may still be settling (retry or compaction). Holding the drawn turn keeps the status authoritative. The cost: during post-reply work that keeps the run active (such as automatic compaction), the finished reply still reads "Vastaa…" with the working row until the run settles. That is consistent with the Stop button shown at the same time.
- **A streaming reply looks like a finished one.** It no longer has the bordered alert-card look. Alternative: keep a distinct streaming card and animate the change. Identical geometry removes the reflow without guessing heights, and the streaming state stays visible in the header label and the working row.

Live check: in a conversation, send a message and watch the moment the reply finishes, on desktop and phone. The reply text should not jump or resize, and the working row, the reply's "Valmis" mark and Stop→Send should change at the same instant.
