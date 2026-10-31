# Result: the next-waiting row as a state machine

Prototype: `prototypes/tilakoneet.html` (one hand-written offline page,
picker Nykyinen · Työn ajan · Saapuminen · Kierros eteenpäin; built from
`prototypes/page.src.html` by `python3 prototypes/build.py`, which inlines the
design-system tokens and fonts). Jari's guide in Finnish: `prototypes/NOTES.md`.
Screenshots (device scale factor 2, AVIF): `prototypes/kuvat/`.

## Current behaviour (Nykyinen)

Read from `web/src/app/NextWaitingDock.tsx`, `nextWaiting.ts`, `App.tsx`
(how the dock is fed), `BrowserConversation.tsx` (`working` =
`presentation.activity === "working"`, `needsYou` = stale or unknown status or
`pending_question`) and `railNow.ts` (Sinun vuorosi = unread reply, or
question while running). States: hidden without latch, row shown, latched
but hidden (asks / nobody else waits), round at a step, round at the origin.

Defects, checked against the code; 1 was also reproduced by a temporary
browser probe (`web/tests/zz-proto-nw-states.spec.ts`, not committed):

1. **The row stays when the agent finishes** (Jari's screenshot). The
   `engaged` latch is never cleared during the visit and `needsYou` does not
   cover a finished turn. The current spec asserts this ("It stays when the
   agent finishes").
2. **The round returns to the origin automatically**: the last step's
   button is *Lähtöön*, and `WaitingRound.move` past the end opens the origin.
3. **Read counts as handled**: opening a step marks the reply seen, so it
   leaves Sinun vuorosi and `stateOf` gives it ✓; *Kierros käyty: N hoidettu*
   counts it.
4. **The bar follows outside the round**: the dock draws the bar whenever
   `round.steps` exists, so a conversation opened from the rail outside the
   round shows it until ✕/Esc.

Checked and not a defect: the row never lists the conversation it is in
(`others` filters it). Suspected and **disproved by the probe**: the latch
does not leak into the next conversation. The reason is incidental, though:
the composer area (and with it the dock and its `engaged` state) unmounts
while the next conversation's history loads. `BrowserConversation` is not
keyed per conversation, so the latch is per-visit only because of that gap.
The page marks this as *i*. A second probe run, meant to confirm that ✕ in a
step does not re-offer the row at once, did not get past the slow setup in
the fixture host within its timeout. The model follows from the same unmount.

## Directions (one axis: how strictly the row is tied to this agent working)

All three share Jari's starting points. The row exists only while the host
confirms this conversation's agent works. It is derived per conversation
with no latch, never lists itself, and never leads back automatically.

| | Direction | What it decides | Cost |
|---|---|---|---|
| 1 | **Työn ajan** (strict) | Row only while this agent works. *Avaa seuraava* opens the first waiting one and nothing follows. The next one shows the row again once you answer and its agent works. | A read-only reply stops the walk; the next one is reached from the rail. |
| 2 | **Saapuminen** (one exception) | As 1. In addition, the conversation you reached through the row shows a quiet *Seuraavaksi · nimi · Seuraava* until you act there (send), leave by the rail, or reload. At the last one: *Muita ei odota sinua.* | Seuraava also skips a conversation that asks: a deliberate exception to "hidden while this one waits for you", for the arrival only. |
| 3 | **Kierros eteenpäin** (round detached) | Row as in 1. *Käy läpi* starts a round of the waiting ones without the origin. The bar shows only in its steps, goes forward only, and ends at the last step (*Valmis*) where you stay. Leaving by the rail, ✕ or a reload ends it silently. ✓ only where you sent. | Keeps the round's list, joins, prunes and bookkeeping (most of `WaitingRound`). |

## Host facts each needs

- All: `run_active` / presentation activity `working`, `pending_question`,
  and the rail's Sinun vuorosi (unread reply from this tab's attention
  memory, question from the host). **All exist.**
- Työn ajan: nothing more. The current latch and round are removed.
- Saapuminen: one tab-local fact, "this conversation was reached through
  the row" (one agent id, view state). **Not a host fact; does not exist
  yet, trivial.**
- Kierros eteenpäin: `WaitingRound` without origin and step back, plus
  "the person sent in this step" from this tab's own composer send. **Not a
  host fact; the send is known in the tab but not wired to the round.**

## Recommendation

**Saapuminen.** It keeps Jari's rule ("for the time this agent works") as
the whole rule, plus one exception the person caused with a click: arrival
through the row. That exception fixes the stall the strict version has on a
read-only reply. It needs one remembered id, no list, nothing to end and
no way back. Kierros eteenpäin keeps the tracking machinery Jari called
unwanted. Työn ajan is the simplest but stops at every reply that needs only
reading.

## Questions for Jari

- Saapuminen's *Seuraava* also skips a conversation that asks you
  something. Should it instead stay hidden there, so that a question always
  stops the walk?
- `waiting_background` (the agent's turn is over and a worker still runs):
  should the row count as "the agent works"? The prototype treats only
  `working` as work, as the code does now. The person may have nothing to do
  here while the worker runs, so showing the row would also be defensible.
