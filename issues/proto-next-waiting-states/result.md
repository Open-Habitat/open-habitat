# Result: the next-waiting row as a state machine

Round 1 prototype: `prototypes/tilakoneet.html` (one hand-written offline page,
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

## Recommendation (round 1)

**Saapuminen.** It keeps Jari's rule ("for the time this agent works") as
the whole rule, plus one exception the person caused with a click: arrival
through the row. That exception fixes the stall the strict version has on a
read-only reply. It needs one remembered id, no list, nothing to end and
no way back. Kierros eteenpäin keeps the tracking machinery Jari called
unwanted. Työn ajan is the simplest but stops at every reply that needs only
reading.

## Questions for Jari (round 1)

- Saapuminen's *Seuraava* also skips a conversation that asks you
  something. Should it instead stay hidden there, so that a question always
  stops the walk?
- `waiting_background` (the agent's turn is over and a worker still runs):
  should the row count as "the agent works"? The prototype treats only
  `working` as work, as the code does now. The person may have nothing to do
  here while the worker runs, so showing the row would also be defensible.

## Round 2: the row appears on the person's send (Jari 31.10.)

Jari, after round 1: "The essential state transition is that the banner
appears when the person has sent a message to the agent. That is the moment
it becomes visible, and of course the banner state updates if things
change in the background: it disappears or its content can change."

Prototype: `prototypes/tilakoneet-2.html` (same source, `ROUND = 2`;
picker Nykyinen · Vuoron loppuun · Paikka pysyy · Lähtöön asti),
screenshots `prototypes/kuvat/r2-*`.

Common to all three: the send opens a window in this conversation once the
host accepts the message. While the window is open, the row is derived live
from Sinun vuorosi minus this conversation, so names and count follow the
background. An agent run that the person did not start (no send in this
tab) brings no row. *Avaa seuraava* opens the first waiting one; the window
does not follow, and there the row comes with the person's next send.
A failed send closes the window.

Axis: what closes the window, and how a change looks.

| | Direction | Closes on | How changes look | Cost |
|---|---|---|---|---|
| 1 | **Vuoron loppuun** | this agent finishes or asks, send fails, leaving, reload | the row simply disappears; with nobody else waiting it hides and returns when someone starts waiting | the area above the composer can jump during a turn |
| 2 | **Paikka pysyy** | same | the slot holds: *Kukaan muu ei odota sinua* when empty; at the turn's end *Vastaus valmis tässä* / *Agentti kysyy sinulta* for 4 s | a line with nothing to offer takes the row's height; a self-dismissing notice needs a timer |
| 3 | **Lähtöön asti** | leaving or reload only | after the turn: *Täällä valmis · N odottaa yhä* / *Kysyy täällä · N odottaa myös* | offers to leave a conversation that waits for the person, which is the situation in Jari's round-1 screenshot |

### Host facts

- The send's acceptance by the host: **exists** in the tab, as the
  composer's send result. Today's dock does not use it; it waits for the
  host's `run_active` confirmation.
- Turn end (`working` → not working), `pending_question`, Sinun vuorosi:
  **exist**.
- "The person sent here" as window state: tab view state, one agent id.
  **Does not exist yet**, and it is trivial. It is lost on reload, as
  Jari's "appears on send" implies. The alternative, rebuilding it from
  `run_active` after a reload, would also show the row for runs the person
  did not start.
- Paikka pysyy additionally needs a 4-second timer for the end notice
  (tab-only).

### Recommendation (round 2)

**Vuoron loppuun.** It is Jari's trigger with the round-1 rule ("not while
this conversation waits for you") as its end. It needs only facts that
exist plus one remembered id, and it leaves nothing to dismiss. The
jumping it can cause happens only when someone starts or stops waiting
during a turn, which is exactly the background change Jari wants to see.
Paikka pysyy's end notice repeats what the conversation itself already
shows (the reply or the question card). Lähtöön asti brings back round 1's
defect 1 unless Jari now wants it.

### Questions for Jari (round 2)

- When the window closes because nobody else waits (Vuoron loppuun),
  should it reopen when someone starts waiting during the same turn, as
  prototyped, or stay closed until the next send?
- Round 1's arrival exception (Saapuminen) is not part of round 2. After
  *Avaa seuraava*, a conversation with only a reply to read shows no row
  until the person sends there. Is that the intended rhythm?

## Main as of this merge

The page's *Nykyinen* is main at 77bc6dda, where this round started. Since
then `b136c1c9` (next-waiting-no-return) landed on main:

- defect 1 is fixed: the line shows only while `working`, with no latch;
- defect 2 is fixed: the round starts from the first waiting one, has no
  origin step and no return, and ends past the last step;
- defects 3 (read counts as ✓ handled) and 4 (the bar shows in
  conversations outside the round until ✕/Esc) remain.

Main is now round 1's *Työn ajan* trigger plus a forward round. The round-2
directions differ from main in the trigger. Main shows the line whenever
the host reports `run_active`: also for a run the person did not start, and
again after a reload. Round 2 shows it only after the person's own send in
this tab. Implementing *Vuoron loppuun* on main means replacing `working`
with "sent here, and this turn has not ended", and removing or reshaping
the round according to Jari's answer.
