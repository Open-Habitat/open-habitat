---
created: 2026-11-02
updated: 2026-11-02
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed while verifying live-long-run-gap-under-load under load
source_ref: taskfleet:01m6dhbj8yv17s2rsye0zkg8bh/gate:live-long-run-working
originating_run: 01m6dhbj8yv17s2rsye0zkg8bh
originating_run_kind: spinoff
---

# live-long-run spec misses the working state under heavy load

## Description

Observed while verifying `live-long-run-gap-under-load` on Birch (14 busy loops
under `timeout` beside four parallel workers, load average ~25):
`live-long-run.spec.ts` failed 4 of 13 runs with the fix and 1 of 5 on the
unfixed tree at

    expect(getByTestId("message-input").and('[data-working="true"]')).toBeVisible({ timeout: 15000 })

In every failure the run itself completed ("Pitkä ajo valmis." shown, no
missed-events notice); the page simply never observed `data-working="true"`.
The composer's activity comes only from controller status
(`current.run_active`, BrowserConversation.tsx), refreshed by the active
conversation's status events through `useConversation.refresh`, which queues
behind a pending read. Under starvation the status read that would report
`run_active` apparently lands only after the ~8 s run has settled.

Impact: on a heavily loaded gate host the spec fails without any product
fault visible to a person, the same release-blocking flake class as the
original issue. Open question for triage: is it the spec (it should wait on
something the run is guaranteed to show, or accept a run that was observed
through its live turn), or should the composer show working from the live
stream when status lags?

## Triage analysis

**Verdict.** This is not a spec bug and not a bug in the composer's status
logic. The cause is page throughput. Every live event re-renders the whole
open conversation synchronously. When the browser gets little CPU, the page
falls seconds behind the event stream. A status reply that arrived at the
network layer within a millisecond reaches the page's JavaScript only after
the backlog has drained, and by then the run has settled. The spec catches
this first because its run fires about 160 events/s. A person would see the
same lag only on a CPU-starved client: a weak device during a very
event-dense run. The cause is the server's load only when the browser runs
on the same host, as in the gate. Real Pi runs are much slower than the
fixture, and nobody has reported this from use.

**Severity.** Normal for the gate, because the spec fails 25–50 % of runs on a
loaded host and blocks the gate as `live-long-run-gap-under-load` did. Low for
the product: no wrong state is shown. Everything is just late on a starved
client, including send acknowledgements and Stop.

**Affected area.** `web/src/app/conversationStore.ts`: `publish()` notifies
the listeners of the `useWindow` `useSyncExternalStore` once per event, and
React renders `BrowserConversationContent` synchronously each time. The
`conversationJournal.ts` → `routeEvent` → `applyEvent` path is how the events
get there.

**Repro status.** Reproduced on Birch (8 vCPU), 2.11.2026, using
`OH_PORT_BASE=10470`, a disk-backed `TMPDIR`, and 14 `timeout`-bounded busy
loops beside 4 Playwright workers (`--repeat-each`), load average about 25–30:

- The unchanged spec failed 4/8 and 6/16 runs (10/24 in total), every one at
  the `data-working="true"` expectation. Unloaded it passed 3/3.
- An instrumented copy, local only and deleted afterwards, recorded fetch
  timing, Resource Timing, SSE `emitted_at` lag, `data-working` changes and
  long tasks. Across 8 runs at that load:
  - The first live event of the run (`pi.lifecycle`) was handled 30–90 ms
    after the send in every run.
  - The page was 5.8–8.1 s behind the server's `emitted_at` when it handled
    `turn.settled`. Unloaded the lag was ≤ 0.4 s.
  - The status read following the send was issued 40–60 ms after the send. It
    was the only read in flight, so nothing was queued ahead of it. Resource
    Timing shows the server answered in about 1 ms (`responseEnd` 1–2 ms after
    `requestStart`, HTTP/1.1). The JavaScript `fetch` resolved 0.2–17 s later,
    and in 4/8 runs only after the page had already handled `turn.settled`.
    That late reply said `state=accepted run_active=true`, so the composer
    showed working for about 100 ms after the run ended, and the next read
    turned it idle.
  - Main-thread long tasks during the run totalled 15–18 s.
- An accidental heavier load (about 45 loops, load average about 60) gave a
  lag of 16–30 s at settle, and every run failed.

**Root cause, with evidence.**

1. The hypothesis that the status read queued behind a pending read is
   **refuted** as the cause. `useConversation.refresh` does queue later
   refreshes behind `pending.current`. But in the failing runs the read in
   flight was itself the one carrying `run_active=true`, issued promptly and
   answered promptly by the host. An unqueued read would have resolved just
   as late, because the delay is in the page's event loop, not in the
   request.
2. A CPU profile of an unloaded run (temporary unminified build, reverted)
   shows about 4.5 s of main-thread work in an 8.6 s window. About 3.7 s of
   it is synchronous React rendering started from the store subscription
   (`performSyncWorkOnRoot` via the microtask after each SSE event), with
   `BrowserConversationContent`, `provisionalItems`, `formatDate`,
   `scrollToEnd` and React Aria buttons/icons on top. Even unloaded, the page
   spends about half a core keeping up with about 160 events/s. Under load
   the renderer gets less than that and falls behind. Chrome then delivers
   the queued SSE messages ahead of the fetch completions.

**Options.**

- **(a) Spec waits on something the run is guaranteed to show** (the first
  live tool step, and the run's span measured from the stream). This is the
  cheapest option, and it removes the flake. But the page still lags. The
  spec's 7000 ms working-span check also fails under load and would have to
  be redesigned too. The spec would then no longer show that the composer
  stays working through a long run that crosses the tail bound, and no other
  spec checks that.
- **(b) The composer also derives working from the live stream** (an
  unsettled `pi.lifecycle` start). This would work, since the stream showed
  the start within 90 ms in every run. But it creates a second source of
  truth beside controller status. `submit`/`submitQueue` in
  `ConversationActions.tsx` and `agentPresentation` are gated on
  `current.run_active`, so Enter in steer mode would silently do nothing
  until status caught up, unless those guards changed too. It also fixes
  only the composer: the send receipt, Stop and every other reply would
  still arrive seconds late.
- **(c) Refresh no longer queues the status read behind a pending read.** This
  does not help. Point 1 above shows the read was not queued.
- **(d) Coalesce window notifications in the store** (recommended). `publish()`
  still updates `record.value` at once, so the event order, recovery and
  `store.read()` stay synchronous. Only the listener calls are deferred to one
  flush per short timer (a 16 ms `setTimeout`, which also runs in hidden
  tabs, unlike `requestAnimationFrame`). One render then covers every event
  received since the last flush.

  I tried this as a local experiment, then reverted it:
  - At the same load, the unchanged spec passed **16/16**, against 6/16 for
    the paired run without it.
  - Instrumented over 8 runs: SSE lag at settle 49–113 ms (max 189 ms),
    against 5.8–8.1 s. Working was shown 100–300 ms after the send. Long-task
    time was 3.2–4.2 s, against 15–18 s.
  - `browser-conversation`, `queued-send`, `github-stream` and
    `live-long-run` passed 93/93 unloaded.
  - Vitest passed 1214/1215. The one failure is
    `conversationStore.test.tsx` › "background text deltas notify only their
    window, not sidebar metadata", which expects a synchronous notification.

**Recommendation: (d).** It removes the cause instead of the symptom. It keeps
controller status as the only source of the working state. It shortens every
reply on a slow client, not just the composer's. And it leaves the spec and
its working assertions unchanged, so they keep guarding behaviour.

**Fix sketch.**

- `web/src/app/conversationStore.ts`: in `publish()`, mark the id dirty and
  schedule one flush, which calls the listeners of each dirty id once. Clear
  the timer in `dispose()`. Metadata notifications (`applyStatus`,
  attention) stay synchronous. They are rare, and status must not wait behind
  a window flush.
- `web/src/app/conversationStore.test.tsx`: make the existing test advance
  fake timers before asserting. Add one test asserting that many events
  routed in one task produce exactly one window notification, with the
  newest value. That invariant fails if anyone brings per-event synchronous
  notification back.
- **Risk:** low to medium. A React update from the store may now wait up to
  16 ms, so code that reads the DOM right after a store event assuming a
  synchronous render could break. The browser cases above did not hit this.
  The fix should also run `lab-conversation-scroll`, `lab-long-stream` and
  `lab-conversation` (lab config), because the reading-position anchor logic
  runs on every window render.
- **Test so that a real regression still fails:** keep `live-long-run.spec.ts`
  as it is. Run it with `--repeat-each 8 --workers 4` beside 14 busy loops
  bounded by `timeout`, both before and after the change, and record the
  pass counts in this issue. Alongside that, run the new store unit test.

**Incidental observation (not filed).** `conversationStore.ts` tests
`event.payload.state === "pending"` for `command.changed` in three places. The
contract and the daemon (`conversation_linux.go` `receipt`, `held_linux.go`)
send `acceptance`/`execution`, never `state`, so those branches cannot run.
Its user-visible effect, if any, is unverified.
