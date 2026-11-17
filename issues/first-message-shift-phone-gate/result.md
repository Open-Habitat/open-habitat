# Result

The 0.079 shift was not the composer or the message moving. A warning card,
"Tapahtumia jäi väliin" (`event-gap`), appeared above the composer for
200–450 ms just as Send turned into Stop. It pushed the stack 98 px up and
dropped it back. It now waits for the native read that already closes the gap,
the same way the stale-status warning waits. Under load the same send showed a
second fault: the activity line ("Näytä työ · Agentti työskentelee") could
vanish while Stop was still shown. That is fixed too.

## What moved

Gate log measurement (390 px, creating): the stack top went 759 → 661 → 759
between t≈258 and t≈321 ms, while the background strip stayed at 759. Shift
sources were `ah-composer-stack`, then `ah-composer-stack`, `ah-message` and
`ah-title-row`: 0.029 + 0.037 of the 0.079.

Reproduced on main with temporary per-frame instrumentation of the stack's
children and the notice stack, plus the snapshot responses (removed again).
Conditions were 390 px, `OH_CPU_THROTTLE=6`, `OH_REPLY_DELAY_MS=250`, four
workers, 24–30 repeats. The exact 0.079 (and 0.074) recurred. The 89 px child was
`notice-stack` holding `event-gap`. At 4× throttle with 10 repeats it did not
appear, which fits the gate failing only under full-suite load.

### Cause 1: the event-gap card on a new conversation

On a loaded host, the first snapshot that seeds a new conversation's live
state is behind the event router. In the failing runs it was snapshot cursor 6
with `history: readable` and a `pi.lifecycle` tail. The router had already
passed events for this agent that no window had applied yet.
`conversationStore.seedLive` therefore correctly marked the window `missed`.
`readMissed` started a native re-read at once. When that read joins, `missed`
clears. In between, the first status with `run_active: true` arrived, and
`showMissedEvents` put the card on screen until the read joined. The
earlier fix (`68feb775`) covers only the empty-history, empty-tail seed, so
it did not apply here.

### Cause 2: the activity line dropped during the loading view (load-sensitive)

With 6× throttling, 6 of 30 runs on main failed the "activity line stays until
Send" assertion, and 1 of 10 at 4×. The running turn appeared as a live row
while the view was still `loading` (route has an ID, first read not joined).
The turn-end hold from `turn-end-jitter` records a live row only "beside a
readable history window", and `historyReadable` is false before `opened`. So
when the read returned with the saved final reply before the status ended the
run, the turn was drawn finished while Stop stayed. A conversation created in
this view has no earlier turn, so this hold condition is safe for it before
the first read.

## Fix

- `BrowserConversation.tsx`: the event-gap notice uses `useSettledWarning`
  (800 ms, keyed to the conversation), like the stale-status, history and
  recovery cards. The store's `missed` mark, its re-read and the composer's
  `suppressAvailabilityReason` stay immediate. Only the card waits. A gap that
  the read does not close within the delay is still shown.
- `BrowserConversation.tsx`: a `createdInView` ref is true when this mount
  began as a creation, so a conversation reopened later is not covered. The
  turn hold (`turnsKnown`) also counts a live row while such a view loads.
  `historyReadable` itself is unchanged, so message-alias registration keeps
  its old rule. An early variant that widened `historyReadable` produced one
  double user-message mount in 40 runs, and it was narrowed for that reason.
- Vitest `conversationView.test.tsx`: a running conversation with a journal gap
  shows no `event-gap` at once and shows it once the read has not closed the
  gap.

The budget and the measurement are unchanged.

## Verification

- `lab-first-message-flicker.spec.ts`, all four cases (1440/390 ×
  creating/opened), `--repeat-each 10`, 3 workers, `OH_CPU_THROTTLE=4`,
  `OH_REPLY_DELAY_MS=250`: **40/40 passed**, twice (once before narrowing,
  once with the final diff).

  | Case | Shift range (final, 10 runs) |
  | --- | ---: |
  | 1440 creating | 0.0064–0.0293 |
  | 1440 opened | 0.0010–0.0263 |
  | 390 creating | 0.0160–0.0237 |
  | 390 opened | 0.0014–0.0164 |

- Stress, 390 both phases, `OH_CPU_THROTTLE=6`, 30 repeats, 4 workers:
  59/60. Max shift was 0.0244 (creating) and 0.0179 (opened), with no event-gap
  frame and no activity-line drop. The one failure is the case below.
- Lab neighbours (`lab-turn-end-jitter`, `lab-live-turn`, `lab-turn-stages`,
  `lab-long-stream`, `lab-conversation-scroll`), 3×, 4× throttle: 45/45.
- Ordinary neighbours (`live-long-run`, `queued-send`, `browser-conversation`,
  `native-live-join`, `turn-work-row`, `new-conversation-placeholder`), 3×,
  4× throttle: 333/333.
- `./scripts/test-web-fast.sh`: 230 files, 1,824 tests passed.
- Not run: whole suites, the clean gate, a live installation.

Evidence: measurement JSON of the final 4× matrix under
`/var/tmp/agent-keep/first-message-shift-phone-gate/`. The gate's own
measurement was read from the conductor's gate log and is quoted above.

## Remaining, filed separately

At 6× throttle, about 1 run in 30–60 (390 creating) never shows the activity
line. The fake turn finishes and its history is read before the first status
saying the run is active arrives. Stop then shows for one status read next to
a finished reply. Drawing that turn as running would revive a finished turn,
which `turn-end-jitter` decided against. Not seen at 4× (80 runs). Filed as
`first-turn-ends-before-running-status` (unlaned, through intake).

## Decisions for later review

- **The event-gap card waits 800 ms like the other recovery cards.**
  Alternatives: have the store replay buffered routed events into a late seed,
  so no gap exists; or skip marking a gap when an in-flight read began after the
  routed events. Both change store recovery semantics, which several journeys
  depend on. The delay changes only presentation, matches the existing
  stale-status rule, and still shows a gap the read does not close.
- **The hold counts a loading view's live row only for a conversation born in
  this view.** Reopened conversations keep the old rule, because before their
  first read an unseen turn may be an earlier one (native wake).

Live check: on a phone, create a conversation and send the first message
immediately. No "Tapahtumia jäi väliin" card should flash above the input as
Send turns into Stop, and "Näytä työ · Agentti työskentelee" should stay until
Stop turns back into Send.
