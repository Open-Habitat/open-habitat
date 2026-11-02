---
created: 2026-11-02
updated: 2026-11-02
type: task
reporter: jari
status: open
priority: high
lane: gate-load-flakes
lane_seq: 3
preparation: ready
---

# Find every load-sensitive browser case in one sweep instead of one gate at a time

## Description

Jari 2.11.: there is a lot of "the test fails under load". Each clean gate
on 2.11. surfaced 2–3 new load-only failures (r54 gate 1: speech-input,
account-settings ×2; gate 2: next-waiting-row, settings-search), and each
investigated one so far was a **real product timing defect** (caret and
focus lost across load-time view swaps, a re-render per live event that made
the page lag seconds behind). Load acts as a race detector, but finding the
races one gate at a time costs a gate and a worker round each.

Do it once, as an analysis first (no product changes in this unit): run the
whole ordinary and lab suites under deliberate slowness — Chromium CPU
throttling through CDP (`Emulation.setCPUThrottlingRate`, e.g. 4×) and/or
`timeout`-bounded busy loops, `--repeat-each 3` — collect every failing
case, and group them by mechanism (focus/caret after a view swap, a status
read arriving after the event it describes, list order changing after
render, a spec waiting on the wrong signal, …). For each group: product
defect or spec defect, what a person would see, the shared fix (a helper or
pattern that removes the class, not one fix per spec). Recommend how the
gate keeps catching this class cheaply afterwards (for example a throttled
repeat of the recently changed specs, or a periodic stress run outside the
gate).

## Acceptance Criteria

- [ ] One list of all load-sensitive cases with counts, grouped by mechanism, product vs spec, and a fix per group.
- [ ] A recommendation for keeping the class caught; no product code changed in this unit.

## Jari 2.11.: why only under load, and find them all at once

The defects exist all the time; load only flips an order that is never
guaranteed. Two things are wrong: code that acts "on the next frame" or "when
this effect runs" instead of on state that is certainly ready, and tests
that only ever run the lucky order (a synthetic host answering in a
millisecond, an idle machine). So the recommendation must cover
**prevention while writing**, not only detection in the gate: for example
the synthetic host delaying replies (configurable, on by default in focused
runs) and CPU throttling in workers' own spec runs, so a race fails on its
first run; and a rule for the code (focus and state follow a ready state,
not a timer or frame), stated where `web/AGENTS.md` would carry it.

## Sweep analysis

Done 2.11. on Birch (8 cores) from main `df02b6db`. No product, spec or
fixture code changed; the throwaway instrumentation is kept as
[sweep-instrumentation.diff](sweep-instrumentation.diff) for the fix unit.

### Summary

79 browser cases fail under slowness or reordered replies. They fall into
nine mechanisms: five are product defects, four are spec defects. Two
detectors did the work, and they find different things:

- **Replies delayed by a random 0–250 ms** (the synthetic host sleeps before
  each `/api/` reply; the event stream is not delayed, so events usually
  arrive before the replies that explain them, as on a slow real link):
  70 cases, most of them deterministic (2/2).
- **Chromium CPU 4× through CDP**, beside other host load: 13 cases. Alone on
  an idle machine 4× finds 2 of those 13 and 2× finds 1.

| # | Mechanism | Kind | Cases | What a person sees | Fix order |
| --- | --- | --- | --- | --- | --- |
| 1 | An older status or reply overwrites a newer one; a command's outcome depends on which reply lands last | **product** (2 confirmed) | 19 | On a slow link a sent message comes back into the field as if unsent, a draft written meanwhile is lost, a steering message vanishes for a moment, a reply already read returns as unread | 1 |
| 2 | Input arriving before the view is ready: the loading view is swapped for the real one, or the send is silently refused | **product** | 12 | Enter does nothing in a just-opened conversation; typing during a turn loses focus | 2 |
| 3 | A side effect taken from a render snapshot misses a short-lived state | **product** (confirmed) | 3 | The editor never notices that the agent changed the open file | 3 |
| 4 | A callback uses a value captured at render after the page has moved on | **product** (1 confirmed) | 3 | Undo on a workspace page throws the person to the home view | 4 |
| 5 | Focus return or an overlay after closing something lands on nothing | product, unconfirmed | 8 | Esc closes a panel but focus is lost; a tooltip covers the next button | 5 |
| 6 | The spec races a real product timer against the wall clock | spec | 4 | nothing (the product timer is right) | 6 |
| 7 | The spec assumes the synthetic Pi is slower or faster than the browser | spec (1 confirmed) | 8 | nothing | 6 |
| 8 | axe, screenshot or geometry read during an animation or remount | spec (confirmed) | 8 | nothing (the 220 ms fade is designed) | 6 |
| 9 | Spec plumbing: a response body read after navigation, a route handled twice, Chromium net retries | spec | 6 | nothing | 6 |
| — | Budget only: passes when timeouts are ×4 | neither | 5 | nothing | not fixed |
| — | Already fixed on main (next-waiting-row `:228`, settings-search `:70`) or not settled (speech-input `:498`) | — | 3 | — | — |

Recommendation in short: fix groups 1–4 in the product, in this order, then
the spec groups in one helper pass. Make the host's reply delay a seeded,
default-on part of every focused browser run (60 ms jitter costs 2–6 % per
case and caught a third of the delay cases on two repeats). Keep CPU
throttling and 250 ms jitter for a periodic stress run outside the gate.
Add the code rule below to `web/AGENTS.md`. Most of groups 1, 3 and 4 can
then be pinned in Vitest with a controlled transport instead of the browser,
as `orderings.md` asks.

### How it was run

All runs: `OH_PORT_BASE=10700` (ordinary) and `10800` (lab), disk-backed
`TMPDIR=/var/tmp`, prebuilt web and host, Playwright at `nice 5`, traces off,
6 + 3 workers as the gate, whole suites under `browser-suite-lock.py`.
The worker on `gate-load-flakes-waiting-search` ran up to 22 busy loops
beside the first sweep, so that run had real host load as well.

| Run | Setting | Cases run | Failed | Wall |
| --- | --- | --- | --- | --- |
| CPU 4×, default timeouts (stopped after 5 min) | `OH_CPU_THROTTLE=4` | 119 | 57, nearly all at the 30 s test or 5 s expect budget | — |
| CPU 4×, timeouts ×4 | `+ OH_TIMEOUT_SCALE=4`, `--repeat-each 3` | 1620 + 489 | 19 + 5 (13 cases) | 47 + 44 min |
| Delay 0–250 ms | `BROWSER_HOST_REPLY_DELAY_MS=250`, `--repeat-each 2` | 1080 + 326 | 74 + 38 | 16 + 14 min |
| Delay 0–250 ms, timeouts ×4 | ordinary only | 1080 | 86 | 18 min |
| Delay 0–60 ms | the 70 failing cases, `--repeat-each 2` | 134 + 70 | 22 + 9 (23 cases) | 3 + 2 min |
| No delay, no throttle | the same subset | 134 + 70 | 1 (rail-icons-quiet, flaky without load too) | 2 + 1½ min |
| CPU 2×, idle | the 13 throttle cases ×3 | 45 | 1 | 1 min |
| CPU 4×, idle, timeouts ×4 | the same | 45 | 4 (2 cases) | 2 min |

Scaling the timeouts ×4 removed almost nothing from the delay failures (74
→ 86 on a second sample): those pages wait for a state that never comes,
not for a slow one. Without the scale, CPU 4× drowns everything in budget
timeouts, which says nothing about races.

Cost per passing case (mean, ordinary suite): unloaded subset 3.7 s, delay
60 ms 3.8 s (lab 4.4 → 4.7 s), delay 250 ms 4.2–4.5 s, CPU 4× 9.5 s.

### The groups

**1. An older reply overwrites a newer one (product).** A conversation's
status reply carries `event_cursor`, but `ConversationStore.applyStatus`
applies every status it is given, in arrival order, and
`useConversation.refresh` and the send path infer a command's outcome from
whichever status, receipt or send reply lands last. On a slow link the event
stream (one open connection) is ahead of every request, and two reads in
flight come back in either order.

- Confirmed, `browser-conversation :1517` (2/2 at 250 ms and at 250 ms ×4;
  trace): the send's reply said `pending`; the person typed a new draft and
  switched conversations; on return the remounted view took the unconfirmed
  send for an unknown outcome and put its text back into the field,
  replacing the draft. A person on a slow connection sees their sent message
  back in the field (and may send it twice) and loses what they wrote.
- Confirmed, `:2756` (2/2, trace and error context): the send failed in the
  network; instead of the uncertain card that gives the text back (the fast
  order), the timeline shows the message as "Toimitus epävarma", the field
  is empty and Send stays disabled. The same outcome is drawn two ways
  depending on reply order.
- Same mechanism, not traced one by one: `:488` ×3, `:684`, `:900`,
  `:2486`, `:2701` (the send outcome marker never appears), `:1140` (the
  steering text is for a while in neither field, queue nor timeline),
  `:1011`, queued-send `:170`, `:491`, `:599`, `:617` (Stop against a queued
  or held message), lab-conversation `:1308`, rail-turn-returns `:34` (a
  reply read live is unread after reload), `:1407` (a warm return reads
  status), `:1938`, `:1998` (after a daemon restart), `:2395`, `:1594`
  (the guards meant to drop a late status). `status-stuck-working-after-release`
  (Stop stays in the gate) is the same family seen from the other side: the
  view kept a status from before the turn ended.
- Shared fix: one merge rule for statuses in the store, used by every
  reader: apply a status only if its `event_cursor` is not older than the
  one held for that conversation (same daemon instance), and decide a
  person's own command from the record of that `command_id` (send reply,
  receipt, status naming it), never from a status that predates it. A
  remounted view resumes an outstanding command from that record instead of
  treating "not confirmed yet" as unknown.
- Files: `web/src/app/conversationStore.ts` (`applyStatus`),
  `useConversation.ts` (`refresh`), `ConversationActions.tsx` (`submit`,
  `submitQueue`), `sentMessages.ts`; specs stay as they are.

**2. Input before the view is ready (product, plus specs waiting for the
wrong signal).** A new or reloaded conversation first shows the loading view
with its own composer and then swaps in the real view; `submit` returns
silently while the status is not yet `idle`.

- long-pause `:32` (Enter right after creating: nothing sent, text stays,
  no word why), lab-composer-area `:122` (same), queued-send `:491` (second
  message while the first is unconfirmed), lab-composer-live-focus `:28`
  (4/4: typing during a live turn, focus leaves the field to `body` twice:
  the field was replaced), settings-close `:81`, `:122`, `:160` (the marked
  frame was the loading view's, replaced after Settings closed),
  lab-composer-bang-spacing `:9` (the screenshotted region detached),
  lab-composer-area `:206` (`/` typed before Pi's command list arrived; the
  list opens empty and never fills), `:349`, new-conversation-placeholder
  `:39`, server-version-reload `:140`.
- Shared fix: the loading and the opened view share the composer element
  (same component instance; props change, the textarea stays), which also
  removes what `65877f4e` patched; an action that cannot run yet is either
  kept and run when the view is ready or refused visibly. Specs wait for the
  ready signal they need (send enabled in `send` mode), through one helper.
- Files: `PendingConversation.tsx`, `BrowserConversation.tsx`,
  `components/composer/Composer.tsx`, `ConversationActions.tsx`; spec helper
  in `tests/`.

**3. A side effect read from a render snapshot (product, confirmed).**
`BrowserConversation` tells the editor about a finished tool call from a
`useEffect` over the live window. Under CPU 6× with host load,
browser-editor-concurrent `:137`, `:66`, `:158` failed 14/18. Instrumented:
in the failing cases the `edit` tool was rendered as `running` and never as
`succeeded`, because the turn settled and the live window was replaced in
the same render, so the editor's `observe` was never called. A person sees
no "the agent changed this file" note while editing a file the agent just
wrote. Fix: report a finished tool where the event is routed
(`conversationJournal.ts` / `conversationStore.ts`), not from rendered
state. Files: `BrowserConversation.tsx` (the `reportTool` effect),
`BrowserDocument.tsx`.

**4. A value captured at render, used after the page moved on (product).**
Confirmed, lab-workspace-page `:431` (22/24 at CPU 6× with load,
instrumented): archiving a card on a workspace page recorded the route as
`/workspaces` although the page was at `/workspaces/ws_…`, so Undo
navigated home. `changeArchive` reads `location` from the render its
callback came from (`App.tsx`, `fromRoute`; the card's handler through
`useCardArchiveAction`). Likely the same: view-links `:163` (the card opens
the address it had before the refresh, 2/2 even at 60 ms),
lab-workspace-page `:180`. Fix: read the route and other moving values when
the action runs (router's current location or a ref), not from the
closure.

**5. Focus or overlays after closing something (product, unconfirmed).**
status-bell `:122` (Esc closes the panel, focus not on the bell; the bell's
label changes when a late condition arrives), lab-composer-area `:349` (Esc,
focus not back on the attach button), lab-skill-invocation `:9` (Esc does
not close the reader), rail-groups `:15` (the "Uusi työtila" tooltip stays
over the refresh button for 30 s), browser-shell `:104`, `:239`,
workspace-editor `:276`, thread-fill `:13`. The static inventory of focus
moved by a frame or a microtask, the pattern behind `65877f4e`, is the
first place to look: `Navigation.tsx:128,164`, `ArchiveNotice.tsx:74`,
`App.tsx:365`, `BrowserConversation.tsx:516,1266`,
`Composer.tsx:669,1403`, `BrowserShell.tsx:242`, `WorkspaceEditor.tsx:484`,
`ViewHost.tsx:257,288,344` (`setTimeout 0`), and `queueMicrotask` focus in
`Overlays.tsx:224`, `GitStatus.tsx:202`, `BackgroundStrip.tsx:355`,
`WorkspaceGitLayer.tsx:69`, `WorkspacePage.tsx:402`.

**6. The spec races a product timer (spec).** browser-editor-concurrent
`:66` lines 86 and 98: the test's own steps take longer than the 2 s typing
pause, so the import happens as designed. lab-conversation `:819`: the
stand-in `EventSource` never fires `open`, so the 8 s connect watchdog in
`conversationJournal.ts` replaces it. lab-conversation-scroll `:261`
(700 ms bound measured in wall time), lab-conversation `:307`,
pi-onboarding-race `:6`. Fix: drive product timers with `page.clock`;
make stand-ins honour the readiness contract (fire `open`).

**7. The spec assumes the synthetic Pi's speed (spec).** Confirmed,
rail-archive `:6` (3/3 at CPU 4×): the turn ended while the conversation was
still shown, so the reply was seen and the row correctly sits in Hiljaiset,
not Sinun vuorosi. Also browser-conversation `:1878`, `:2046`, `:3573`,
`:2242`, lab-conversation `:1268`, `:1127`. Fix: hold the fixture
transition the case depends on and release it after the precondition (the
`hold` pattern next-waiting-row already uses).

**8. axe or a screenshot during an animation (spec, confirmed).** The
contrast failures read text colours between the start and end of the
220 ms `.ah-landing-enter` fade that follows a shown landing (colours such
as `#a7a9ab`, `#7b7d80` on the same element across runs).
shell-accessibility `:64`, workspace-count-rail `:45`, `:128`, integrations
`:823`, start-here `:23` ×4, browser-editor `:220`,
lab-integration-inventory `:11` ×4, browser-conversation `:3622`. Fix: set
`reducedMotion: "reduce"` in both Playwright configs' `use` (the app already
honours it) and let the few motion specs opt back in.

**9. Spec plumbing (spec).** lab-conversation `:388` and lab-slow-creation
`:4` read a response body after a navigation; lab-outage-account `:9`
fulfils a route that was already handled; site-onboarding `:50` and
rail-running-after-done `:17` hit `net::ERR_TOO_MANY_RETRIES` from Chromium;
pi-onboarding-restart `:52` (1/2, only with ×4 timeouts) is unplaced and
filed here for the same pass.

**Budget only.** agent-file-offers `:300`, server-version-reload `:90`,
own-machines `:317`, clone-page `:601`, settings-model-picker `:232` and the
4×-default-timeout timeouts
pass when timeouts are scaled. They are why a saturated gate fails on long
journeys; the fix is keeping the gate below saturation, not longer timeouts.

**Not reproduced.** speech-input `:498` (2/2 at 250 ms: the region-ask order
after dictation is reversed; either the dictation reused a token from
before the stored region changed, or the spec read the fixture log too
early; needs a probe). lab-workspace-trash `:49` (the parallel worker's
case) passed every run here too.

**The parallel worker's cases.** next-waiting-row `:228` failed 3/3 at CPU
4× at line 254 (spec: the question goes only on an incidental later status
read); settings-search `:70` 1/3 at 4× and at 2×. Both are fixed on main now
(`gate-load-flakes-waiting-search`), and its diagnosis matches this one.

### Order of fixing

0. Add the instrumentation first: the fix units need it to see their
   failures (host reply delay with a seed, CDP throttle fixture, timeout
   scale; see the diff).
1. Group 1 (the store's merge rule): the largest group, and the one where a
   person can lose text or send twice.
2. Group 2 (one composer through the swap; no silent refusal).
3. Group 3 (tool reports from events).
4. Group 4 (stale closures).
5. Group 5, starting from the focus inventory.
6. Spec groups 6–9 in one pass: `reducedMotion` in the configs, `page.clock`
   for product timers, fixture holds, the `EventSource` stand-in, response
   bodies read before navigation.

### Prevention: failing on the first run

**Reply delay, on by default in focused runs.** The host sleeps a random
0–N ms before each `/api/` reply, not before the event stream. Measured:
N = 60 ms caught 23 of the 70 delay cases in two repeats, at 2–6 % extra
time per passing case; N = 250 ms found all 70 over its two runs, at about 15–20 %.
Random jitter is the point: a fixed delay keeps the order and finds only
"everything late". As `orderings.md` asks, the jitter must come from a seed
(`OH_REPLY_SEED`, printed on failure, so a failure reproduces exactly), and
the next step is to delay or swap individual events as well as replies.
Proposal: `browser-focused.py` (and so `test-focused.sh --area browser`)
sets N = 60 and a fresh seed for every run with `--spec` or `--tag`; a
worker writing a spec runs it with `--repeat-each 3`, which costs seconds.
`OH_REPLY_DELAY_MS=0` turns it off. The gate stays without delay until
groups 1–5 are fixed, then takes 60 ms too.

**CPU throttle in the stress run, not by default.** CDP
`Emulation.setCPUThrottlingRate` costs 2.5× per case and alone found little
on an idle machine; it found groups 3, 6 and 7 only beside host load. It
belongs in a periodic stress run outside the gate: both suites with CPU 4×,
reply delay 250 ms, timeouts ×4 (so it reports wrong states, not slowness),
`--repeat-each 2`, under the suite lock (about 50 minutes on Birch), once
per work round or night, with new failures filed. The gate itself can add a
cheap repeat of the specs changed since the last gated tree with the 60 ms
delay and `--repeat-each 3`.

**Without the browser.** Groups 1, 3 and 4 are browser state logic and can
be pinned in Vitest/jsdom with fake timers and a transport the test steps:
deliver this status before that event and the other way round, for each
order. `ConversationStore` already takes its pager as a parameter. Group 2's
composer identity and group 5's focus return are component tests with
React Testing Library. What needs the browser: group 8 (CSS animation),
layout, render throughput (the per-event re-render of
`live-long-run-working-missed-under-load`) and a few journeys through the
gateway and daemon.

### Rule for `web/AGENTS.md`

Proposed text, for the section on how the client is written:

> The order of replies, events and renders is never guaranteed: on a slow
> link the event stream runs ahead of every request, and two reads in
> flight come back in either order. Code acts on state that is certainly
> there, not on timing. A reply is applied only if it is not older than what
> the store holds (`event_cursor`, revision, command id). Focus, caret and
> scroll follow a ready state: the element exists, is enabled and is the one
> that will stay, in a layout effect or the handler that made it so; never
> a frame, `setTimeout(0)` or microtask guessed to come later. A side effect
> owed to an event is taken where the event is handled, not in an effect
> over rendered state, which can skip a short-lived state. A callback reads
> the route and other moving values when it runs, not from the render that
> made it. An input the view cannot act on yet is kept and acted on when it
> can, or refused visibly; never dropped. The loading and the opened view
> share the elements a person may be using.

And for specs (`TESTING.md`): a spec waits for the state it asserts, holds
the fixture transitions it depends on, drives product timers with
`page.clock`, and runs axe and screenshots with reduced motion.

### All cases with counts

Failures / runs. `CPU4` = CPU 4× with timeouts ×4 and host load; `D250`,
`D250x4`, `D60` = reply delay 0–N ms (×4 timeouts); `BASE` = neither, same
build. Multi-variant cases sum their variants. `-` = not run.

| Case | CPU4 | D250 | D250x4 | D60 | BASE | Group |
| --- | --- | --- | --- | --- | --- | --- |
| agent-file-offers :300 | 0/3 | 1/2 | 0/2 | 0/2 | 0/2 | budget |
| browser-conversation :488 (×3) | 0/9 | 6/6 | 5/6 | 0/6 | 0/6 | 1 |
| browser-conversation :684 | 0/3 | 2/2 | 1/2 | 0/2 | 0/2 | 1 |
| browser-conversation :777 | 0/3 | 0/2 | 1/2 | 0/2 | 0/2 | 5 |
| browser-conversation :900 | 0/3 | 2/2 | 2/2 | 0/2 | 0/2 | 1 |
| browser-conversation :1011 | 0/3 | 0/2 | 1/2 | 1/2 | 0/2 | 1 |
| browser-conversation :1140 | 0/3 | 1/2 | 2/2 | 0/2 | 0/2 | 1 |
| browser-conversation :1407 | 0/3 | 2/2 | 2/2 | 0/2 | 0/2 | 1 |
| browser-conversation :1517 | 0/3 | 2/2 | 2/2 | 0/2 | 0/2 | 1 (confirmed) |
| browser-conversation :1594 | 0/3 | 0/2 | 1/2 | 0/2 | 0/2 | 1 |
| browser-conversation :1878 | 0/3 | 2/2 | 1/2 | 1/2 | 0/2 | 7 |
| browser-conversation :1938 | 0/3 | 1/2 | 2/2 | 2/2 | 0/2 | 1 |
| browser-conversation :1998 | 0/3 | 0/2 | 2/2 | 1/2 | 0/2 | 1 |
| browser-conversation :2046 | 0/3 | 1/2 | 1/2 | 0/2 | 0/2 | 7 |
| browser-conversation :2242 | 1/3 | 0/2 | 0/2 | - | - | 7 |
| browser-conversation :2395 | 0/3 | 1/2 | 0/2 | 1/2 | 0/2 | 1 |
| browser-conversation :2486 | 0/3 | 0/2 | 2/2 | 0/2 | 0/2 | 1 |
| browser-conversation :2701 | 0/3 | 2/2 | 2/2 | 1/2 | 0/2 | 1 |
| browser-conversation :2756 | 0/3 | 2/2 | 2/2 | 0/2 | 0/2 | 1 (confirmed) |
| browser-conversation :3573 | 1/3 | 0/2 | 0/2 | - | - | 7 |
| browser-conversation :3622 | 0/3 | 2/2 | 2/2 | 0/2 | 0/2 | 8 |
| browser-editor :220 | 0/3 | 2/2 | 2/2 | 0/2 | 0/2 | 8 |
| browser-editor-concurrent :66 (×2) | 4/6 | 0/4 | 1/4 | 0/4 | 0/4 | 3 and 6 |
| browser-editor-concurrent :137 | 1/3 | 1/2 | 1/2 | 0/2 | 0/2 | 3 (confirmed) |
| browser-editor-concurrent :158 (×2) | 3/6 | 0/4 | 1/4 | 0/4 | 0/4 | 3 |
| browser-shell :104 | 0/3 | 1/2 | 2/2 | 1/2 | 0/2 | 5 |
| browser-shell :239 | 0/3 | 0/2 | 1/2 | 0/2 | 0/2 | 5 |
| clone-page :601 | 0/3 | 1/2 | 1/2 | 0/2 | 0/2 | budget |
| integrations :823 | 0/3 | 2/2 | 1/2 | 0/2 | 0/2 | 8 |
| lab-composer-area :122 | 0/3 | 1/2 | - | 0/2 | 0/2 | 2 |
| lab-composer-area :206 | 0/3 | 2/2 | - | 1/2 | 0/2 | 2 |
| lab-composer-area :349 (×4) | 0/12 | 7/8 | - | 1/8 | 0/8 | 2 and 5 |
| lab-composer-bang-spacing :9 (×4) | 0/12 | 2/8 | - | 4/8 | 0/8 | 2 |
| lab-composer-live-focus :28 (×2) | 0/6 | 4/4 | - | 0/4 | 0/4 | 2 |
| lab-conversation :307 | 0/3 | 1/2 | - | 0/2 | 0/2 | 6 |
| lab-conversation :388 | 0/3 | 1/2 | - | 0/2 | 0/2 | 9 |
| lab-conversation :819 | 2/3 | 0/2 | - | - | - | 6 |
| lab-conversation :1127 | 0/3 | 1/2 | - | 0/2 | 0/2 | 7 |
| lab-conversation :1268 | 0/3 | 2/2 | - | 0/2 | 0/2 | 7 |
| lab-conversation :1308 | 0/3 | 2/2 | - | 1/2 | 0/2 | 1 |
| lab-conversation-scroll :261 | 1/3 | 0/2 | - | - | - | 6 |
| lab-integration-inventory :11 (×4) | 0/12 | 6/8 | - | 0/8 | 0/8 | 8 |
| lab-outage-account :9 (×4) | 0/12 | 3/8 | - | 0/8 | 0/8 | 9 |
| lab-skill-invocation :9 (×6) | 0/18 | 3/12 | - | 2/12 | 0/12 | 5 |
| lab-slow-creation :4 (×3) | 0/9 | 1/6 | - | 0/6 | 0/6 | 9 |
| lab-workspace-page :180 | 0/3 | 2/2 | - | 0/2 | 0/2 | 4 |
| lab-workspace-page :431 | 2/3 | 0/2 | - | - | - | 4 (confirmed) |
| long-pause-composer :32 (×2) | 0/6 | 4/4 | 2/4 | 1/4 | 0/4 | 2 |
| new-conversation-placeholder :39 | 0/3 | 0/2 | 1/2 | 0/2 | 0/2 | 2 |
| next-waiting-row :228 | 3/3 | 0/2 | 0/2 | - | - | spec, fixed on main |
| own-machines :317 | 0/3 | 1/2 | 0/2 | 0/2 | 0/2 | budget |
| pi-onboarding-race :6 | 1/3 | 0/2 | 0/2 | - | - | 6 |
| pi-onboarding-restart :52 | 0/3 | 0/2 | 1/2 | 0/2 | 0/2 | 9 |
| queued-send :170 | 0/3 | 2/2 | 2/2 | 2/2 | 0/2 | 1 |
| queued-send :491 | 0/3 | 1/2 | 2/2 | 0/2 | 0/2 | 2 |
| queued-send :599 | 0/3 | 2/2 | 2/2 | 2/2 | 0/2 | 1 |
| queued-send :617 | 0/3 | 0/2 | 1/2 | 0/2 | 0/2 | 1 |
| rail-archive :6 | 3/3 | 0/2 | 0/2 | - | - | 7 (confirmed) |
| rail-groups :15 | 0/3 | 2/2 | 2/2 | 2/2 | 0/2 | 5 |
| rail-icons-quiet :431 | 0/3 | 2/2 | 2/2 | 2/2 | 1/2 | 7 (flaky unloaded too) |
| rail-running-after-done :17 | 0/3 | 0/2 | 1/2 | 1/2 | 0/2 | 9 |
| rail-turn-returns :34 | 0/3 | 2/2 | 2/2 | 0/2 | 0/2 | 1 |
| server-version-reload :90 | 0/3 | 1/2 | 0/2 | 0/2 | 0/2 | budget |
| server-version-reload :140 | 0/3 | 0/2 | 2/2 | 0/2 | 0/2 | 2 |
| settings-close :81, :122, :160 | 0/9 | 6/6 | 6/6 | 0/6 | 0/6 | 2 |
| settings-model-picker :232 (×2) | 0/6 | 0/4 | 1/4 | 0/4 | 0/4 | budget |
| settings-search :70 | 1/3 | 0/2 | 0/2 | - | - | product, fixed on main |
| shell-accessibility :64 | 1/3 | 2/2 | 1/2 | 0/2 | 0/2 | 8 |
| site-onboarding :50 | 0/3 | 1/2 | 0/2 | 0/2 | 0/2 | 9 |
| speech-input :498 | 0/3 | 2/2 | 2/2 | 0/2 | 0/2 | not settled |
| start-here :23 (×4) | 0/12 | 4/8 | 6/8 | 0/8 | 0/8 | 8 |
| status-bell :122 | 0/3 | 2/2 | 2/2 | 1/2 | 0/2 | 5 |
| thread-fill :13 | 0/3 | 0/2 | 1/2 | 0/2 | 0/2 | 5 |
| view-links :163 | 0/3 | 2/2 | 2/2 | 2/2 | 0/2 | 4 |
| workspace-count-rail :45 | 0/3 | 1/2 | 2/2 | 0/2 | 0/2 | 8 |
| workspace-count-rail :128 | 0/3 | 2/2 | 2/2 | 0/2 | 0/2 | 8 |
| workspace-editor :276 (×4) | 0/12 | 1/8 | 0/8 | 1/8 | 0/8 | 5 |

Group placement is from the error context and the spec; only the rows
marked confirmed were traced or instrumented to the cause. A fix unit
starts each group by reproducing its rows with the instrumentation.

### Reproducing

Apply [sweep-instrumentation.diff](sweep-instrumentation.diff) (host:
`BROWSER_HOST_REPLY_DELAY_MS`; worker fixture: `OH_CPU_THROTTLE`, which also
covers contexts a spec opens itself; configs: `OH_TIMEOUT_SCALE`). Then,
from `web/` with `umask 077`, `TMPDIR=/var/tmp`, `OH_WEB_PREBUILT=1
OH_BROWSER_HOST_PREBUILT=1` after one `npm run build` and
`go build -o .cache/browser-host ./test/browser-host`:

```sh
BROWSER_HOST_REPLY_DELAY_MS=250 OH_PORT_BASE=10900 \
  npx playwright test tests/browser-conversation.spec.ts:1517 --repeat-each 2
OH_CPU_THROTTLE=6 OH_TIMEOUT_SCALE=4 OH_PORT_BASE=10900 OH_BROWSER_WORKERS=6 \
  npx playwright test --config playwright.lab.config.ts \
  tests/lab-workspace-page.spec.ts -g "card archive" --repeat-each 24
```

The second needs host load beside it (eight `timeout 600 sh -c 'while :;
do :; done'` loops). Raw logs, JSON reports and error contexts of every run
are on Birch under `/var/tmp/oh-sweep/` (disposable).
