# Result

The first sent message now stays in one mounted stream and one user-message element through creation, loading and native-history takeover. New conversations grow down from their first message instead of pushing it upwards as the first reply grows. Existing conversation scrolling remains unchanged.

## Measured before changing code

Synthetic lab, production bundle, 1440×900 and 390×900, fresh invented conversation per case. The creation POST was held until a first message had been sent. A `PerformanceObserver` recorded every layout-shift entry (including recent-input shifts); animation-frame sampling recorded route, stream, composer and user-content rectangles. Temporary commit-effect instrumentation in `BrowserConversationContent` recorded every committed view/status/history transition; it was removed from production after the measurement.

Times below are milliseconds from measurement start immediately before Enter. They are observations from one run, not promised request latencies. `y` is the user text's top edge.

### Desktop sequence

| Time | Observed transition / layout | Cause |
| ---: | --- | --- |
| 0 | Creation view, no message; composer y=804 | Starting view |
| 8–11 | Held state commits; user text appears at y=764.8 | Optimistic held message replaces the start page; bottom-aligned timeline moves |
| 341 | Creation rerenders with the same held command | Creation reply/snapshot handoff begins |
| 352–355 | Loading commits; **message disappears** | `CreationStream` is replaced by `LoadingStream`, which renders kept messages but not held messages |
| 365 | Route changes from `new` to `pi:…` | Session creation confirmed; the existing view key already prevents a whole-view remount |
| 435–439 | Opened/idle commits; bubble returns at y=729.8 | A third stream branch mounts; the background control strip takes 35px above the composer |
| 469 | Bubble y=653.0 | Transient stale-status warning adds 76.8px; bottom alignment moves the whole timeline |
| 512–525 | Accepted status; bubble y=729.8 | Successful reread removes the warning; rail working group also changes height |
| 617–622 | First native user entry; held state retires; user y=702.3 | Native entry replaces the held component under a different key/type |
| 627 | User y=630.1 | Turn presentation/reading-position layout catches up after native takeover |
| 763 | User y=626.1 | First saved assistant content adds height below the bottom-aligned user message |
| 1025 | User y=491.1 | More reply content grows below it; header metadata changes width |
| 1064, 1331 | Rail groups move by approximately 28px | Session activity and title observations settle; this does not remount the conversation |

### Phone sequence

| Time | Observed transition / layout | Cause |
| ---: | --- | --- |
| 0 | Creation; composer y=800 | Starting view |
| 8–15 | Held message appears at y=760 | Start page → bottom-aligned held timeline |
| 383–387 | Loading; **message disappears** | Same stream replacement as desktop |
| 389 | Route gets its conversation ID | No whole-view remount was needed or introduced |
| 434–449 | Opened; held message returns at y=616.2 | Stale warning takes 143.8px on the narrow screen |
| 481 | User y=575.2 | Background controls take another 41px |
| 557–560 | Native history arrives; **two copies** at y=467.2 and 575.2 | Native user entry is rendered before held-message receipt reconciliation removes the local bubble |
| 570 | Both copies move to y=611 and 719 | Stale warning disappears |
| 581 | Both copies move back to y=467.2 and 575.2 | A further invalidation briefly restores the warning |
| 633 | Both copies return to y=611 and 719 | Reread removes it again |
| 660–670 | Held state retires; one native copy at y=692 | Receipt reconciliation finally removes the duplicate |
| 682 | Native copy y=611 | Reading-position/layout catch-up |
| 815 | Native copy y=607 | First assistant content |
| 1044 | Native copy y=437 | More reply content grows |
| 1049 | Header metadata shifts horizontally | Updated conversation metadata |

Both widths mounted three distinct user-content nodes. The composer **text field never moved** in either baseline; the stack above it and the bottom-aligned transcript did. Standard cumulative shift (excluding recent input) over the captured interval was approximately 0.028 desktop / 0.398 phone. Phone's initial start-page transition alone contributed another 0.550 that ordinary CLS excludes as recent input.

## Implementation and review

- One `ConversationStream` and `ConversationTimeline` span creation/loading/opened states. Loading failures and creation recovery still have their own notices, not replacement message trees.
- Pending and native messages use `Entry`/`UserMessage` with a presentation-only key alias. Delivery, held queues, receipts, uncertain text recovery and resending remain owned by the existing controllers.
- Alias registration waits for a readable history window (or known-new creation). Matching is anchored after the latest native entry, including tool-only tails; older pages and missing-anchor search windows cannot claim a pending bubble. Aliases are committed in a layout effect, not into shared state during speculative renders.
- Ordinary stale-status presentation uses the existing settled-warning delay; write guards remain immediate. A stale status accompanying an uncertain send is shown immediately so lost-send recovery does not wait behind that delay.
- Focused self-review plus `claude-fable-5-2` finder and `gpt-6-astra` targeted verifier. Confirmed findings fixed: matching older/cold history, the tool-only-tail variant found by the verifier, and a duplicated loading-error card. Deterministic tests cover each. The review did not change the daemon's existing combination of several held messages into one prompt.

## Verification

- Fast web checks: **225 files, 1,776 tests passed**, including types, formatting and static checks.
- New `lab-first-message-flicker.spec.ts`: creation-held and already-opened first sends, desktop and 390px phone. **Five repetitions of this spec only: 20/20 passed**, with two workers, CPU throttling 4×, API jitter 0–250ms, and Playwright tracing enabled.
- Every repeat asserts one user-content mount, the same connected frame/stream/input elements, no missing/duplicate/empty/loading frame after the message appears, <1px user-text/composer vertical displacement, and total layout-shift score <0.05 **including** recent-input shifts.

| Width / first send | Five-run total shift range | User-content mounts |
| --- | ---: | ---: |
| Desktop / while creating | 0.00936–0.02577 | 1 each |
| Desktop / already opened | 0.00033–0.00433 | 1 each |
| Phone / while creating | 0.01606–0.02257 | 1 each |
| Phone / already opened | 0.00046–0.00197 | 1 each |

- Final focused regression selection: new-conversation placeholder, queued send, browser conversation, rewind, and lab conversation scrolling. Ordinary selection: 107/110 passed; lab scrolling: 6/6 passed. Two failed ordinary cases (pending-ack queue and waiting-history handoff) then passed separately and **3/3 repeated each**. The remaining queue-readiness race reproduced against the main browser bundle at `76080d473698cb948623c69336e9c5b32350bc07` and is filed unlaned as `queue-browser-case-readiness-race`, not attributed to this change.
- Earlier malformed-status/logout setup flakes passed on rerun. A lost-send regression exposed by the warning delay was repaired by keeping uncertain-send warnings immediate; its focused rerun passed.
- No Go/contracts changed. No whole suite, clean gate, live installation, real provider or separate-UID isolation claim.

Paired synthetic screenshots and offline HTML: `desktop.png` / `desktop.html`, `phone.png` / `phone.html`. Reviewed at both widths. Full repeat traces, frame measurements and baseline output are retained locally under `/var/tmp/agent-keep/first-message-flicker` for diagnosis; they are not published in git.

## Decisions for later review

- **Locally-created views start at the top, including their empty start page.** Alternative: preserve bottom alignment and reserve guessed reply height or move once on Enter. Top alignment removes the causal height-dependent movement without guessing how long a reply will be. Existing reopened conversations retain their normal reading-position behavior. This intentionally changes the placement of the new-view start page as well as its first turn.
- **Retain message DOM identity without making it delivery authority.** Alternative: change send/receipt reconciliation. Presentation aliases are sufficient and leave cancellation, uncertain sends and native history authoritative.
- **Measure shifts during the recent-input exemption too.** Standard CLS alone can conceal this exact bug; the test uses the stricter sum, while allowing small header/rail metadata changes below 0.05.

Live check: create a conversation and immediately send its first message, then try again after creation has settled. On desktop and phone, the message should appear once near the top and stay there while the first reply arrives; the input stays focused. Also try a slow-start message followed by Stop: its text should return as before.
