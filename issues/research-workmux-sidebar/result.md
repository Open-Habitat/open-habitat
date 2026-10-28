# Result: workmux sidebar research and three prototype rounds

## Research

[report.md](report.md) covers how raine/workmux builds its sidebar (commit
`23c09d88`, installed binary 0.1.277 on Birch), compares it with Habitat's
rail and the Workers panel, and ranks ten ideas. The short version:

- workmux's sidebar is a render-only client in every tmux window. One
  daemon feeds those clients: it polls tmux every 2 s or on a signal, and
  publishes a snapshot that already decides order, grouping, staleness and
  folds. Status comes from agent hooks. For Pi this is an extension that
  reports `working` and `done`; Pi has no waiting state there. A per-pane
  JSON file under `~/.local/state/workmux/agents` keeps the status. "Done"
  clears when the pane gains focus, and that acknowledgement is held in
  the tmux server, so every view agrees. A working agent whose screen
  stops changing for 10 s is marked interrupted.
- Habitat already has the part that matters most: Sinun vuorosi and
  Käynnissä match workmux's "priority" order. Habitat lacks four things
  workmux has. It has no time on rows, because the host publishes no
  last-change time. A long Käynnissä has no structure. There is no quick
  route to the next waiting conversation. "New reply" is tab-local, so it
  is lost on reload and differs between phone and desktop.

## Rounds 1 and 2 (Jari chose Ryhmät and Lopussa)

Both rounds use the same synthetic evening (`prototypes/shared/frame.js`)
and are hand-written single offline files. They stay in the tree for
comparison: [kaynnissa-ryhmat](prototypes/kaynnissa-ryhmat/NOTES.md)
(Ryhmät, Kooste, Työtiloissa) and [seuraava](prototypes/seuraava/NOTES.md)
(Yläpalkki, Sirut, Lopussa). On 2026-10-28 Jari chose Ryhmät and Lopussa.
He asked for round 3 on two questions: whether a worker fits on one line
with a ball alone telling its state, and how Lopussa shows in the
conversation the person is in.

## Round 3

Two directories, each with its own picker. Build and check with
`node prototypes/shared/build.mjs <round>` and
`PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node prototypes/<round>/check.mjs`.
Each check runs every direction at 1440 and 390 px, light and dark, device
scale factor 2, with the interactions clicked, no console errors and no
network. Screenshots are in each round's `evidence/`. The shared frame
gained a few optional hooks (fixture, row, body, dock, send, adjust) and
keeps the stream's scroll position and the composer's draft across
repaints. Rounds 1 and 2 still pass their checks, and their committed
pages and screenshots are unchanged.

### 3a: Ryhmät, compact

Entry: `issues/research-workmux-sidebar/prototypes/ryhmat-tiivis/index.html`.
Guide: [NOTES.md](prototypes/ryhmat-tiivis/NOTES.md).

Every row is one line: a ball, the name and at most one fact. Ten workers
run in `kasvimaa`. There are four balls. Working is teal with a halo and
pulses, and includes waiting on background work. Your turn is amber: a
question or an unread reply. Done is green: the turn ended and the agent
waits for a message. Failed is red. Round 1's Ryhmät rules stay: groups
per workspace, quiet done rows fold, all-quiet workspaces sit under
Hiljaiset, and the current row never folds. A failed row never folds. The
axis is how dense the line is and what it keeps:

1. **Nimi.** Only the ball and the name, in 22 px rows. The time is in
   the tooltip.
2. **Aika.** The time since the last change at the end, in 24 px rows.
3. **Tieto.** The one fact that fits the state, in 26 px rows. A working
   row shows how long it has worked. A row waiting on background work
   shows what it waits for. Your turn shows *kysyy* or *vastasi*. A done
   row shows how long ago it finished, and a failed row shows why.

On the phone, rows are 40 px in every direction, so density is a desktop
axis.

### 3b: Lopussa in the active conversation

Entry: `issues/research-workmux-sidebar/prototypes/lopussa-keskustelussa/index.html`.
Guide: [NOTES.md](prototypes/lopussa-keskustelussa/NOTES.md), which
answers Jari's question in Finnish.

You answer Iltakierros, the agent starts working and streams its reply,
and the next conversation that needs you is offered in this chat. The
axis is when the offer appears, which decides where it can sit:

1. **Heti.** As soon as you send, a card appears at the end of the
   conversation. The reply streams in above it and pushes it down.
2. **Työssä.** Once the host confirms the run, a slim line is docked above
   the composer, outside the stream. It stays there when the agent
   finishes.
3. **Valmiina.** Nothing shows while the agent works. When it finishes, a
   card follows its reply, as in round 2's Lopussa card.

The same in all three:

- Nothing is offered while this conversation itself needs you.
- The offer is round 2's walk: Sinun vuorosi, most recent change first.
- When the offered conversation is handled elsewhere, the offer moves to
  the next one and says so once.
- Alt+↓ opens the offer and Alt+↑ steps back. Both work during streaming
  and while typing.
- A reply that finishes after you left comes back as a new reply and
  re-enters the walk. This makes the answer, move on, come back loop.

## Recommendation

- **3a: Tieto.** The ball tells the state. The fact tells what follows from
  it: kysyy or vastasi, which the single amber ball cannot show, and why a
  row failed. The line stays one line. Nimi is the densest, but it drops
  the question/reply distinction and the failure reason. Aika repeats the
  same kind of fact on every row.
- **3b: Työssä.** The person can leave once the agent has really started,
  that is, once the host confirms the run. Before that the message can
  still fail. A docked line never moves under the streaming reply. Heti
  offers to leave before the message has landed and moves with the
  stream. Valmiina makes you wait for the whole reply.
- **The first implementation step is still the host's last-change time.**
  3a's times and quiet fold depend on it, and so does the walk order.

## Host facts the round 3 views need

- **Time of each conversation's last change** (both rounds; does not
  exist). It is needed for row times, the quiet fold and the walk's
  most-recent-first order. The native source is the timestamp of the last
  entry in the Pi session file. `web/src/app/railNow.ts` keeps catalog
  order because "the host knows no last-activity time", and
  `AgentNavModel.relativeTime` in `web/src/components/Navigation.tsx` is
  never filled.
- **Working, your turn, done** (3a; exist): `activity`, `run_active`,
  `pending_question` and `waiting_on` in `contracts/v1/snapshot.schema.json`,
  derived by `web/src/components/agentPresentation.ts`. "Unread reply" is
  the browser's attention map in `web/src/app/conversationStore.ts`.
- **Failed** (3a; the sources exist, the row fact does not). The sources
  are a Taskfleet run's `failed` state (`contracts/v1/spinoffs.schema.json`),
  `rest.cause: crash` (`contracts/v1/history.schema.json`, `$defs/stop`) and
  an assistant message's `stop_reason` or `is_error`
  (`contracts/v1/event.schema.json`). No per-agent "last turn failed" is in
  the snapshot. It would be derived from these, in the browser or the
  daemon.
- **Work confirmed** (3b; exists): `run_active` and the command state
  `accepted` that `agentPresentation` already reads.
- **Handled elsewhere** (3b; partly exists). An answered question
  disappears from `pending_question` in every view. A reply *read*
  elsewhere does not, because "seen" lives in one tab's memory
  (`conversationStore.ts`). For the full behaviour, the cross-device
  "seen" record from the research report (idea 4) is needed. Without it,
  only questions answered elsewhere move the offer.
- Folds, the walk's visited list and the offer's one-time note are view
  state in the tab.

## Decisions for later review

- **Waiting on background work is a working ball.** Alternative: a fifth
  ball. I chose working because the agent goes on by itself and nothing is
  asked of the person, which is the rule `agentPresentation` already
  states. Tieto still names what it waits for.
- **Failed includes an API error that ended the turn.** Alternatives:
  Taskfleet `failed` and crashes only. An error turn also leaves the
  person to act, so it gets the same signal.
- **Amber for your turn is a prototype colour** (`#b8740b` and `#eab04e`
  in `ryhmat-tiivis/round.css`). The tokens have no warning hue. Working
  keeps the production accent. Done uses `--ah-ok` and failed `--ah-err`.
  Working gets a halo, because teal and green are close without motion.
  If chosen, the amber moves to `design-system/tokens/`.
- **The worker's branch glyph is dropped from the one-line row.**
  Alternative: keep it before the fact. It says nothing about the state
  and costs the name its width. Workers sit in their workspace group.
- **Phone rows are 40 px in every 3a direction.** Alternative: let Nimi be
  denser on the phone too. A touch target under 40 px trades taps for
  density, and the drawer scrolls.
- **Lopussa never shows while the current conversation needs you.** This
  holds in every direction. The alternative is to always show it. Showing
  it would invite skipping the question in front of you.
- **"Seen" on open.** Opening a new reply counts as reading it, so the
  offer shows at once. The alternative is to wait until the reply has been
  scrolled to its end. This keeps today's rule.
- **A reply that lands after the visit re-enters the walk.** The
  alternative is to keep it skipped until the walk restarts. It is a new
  change, so skipping it would hide fresh work.
- **The Työssä line stays when the agent finishes.** The alternative is to
  turn it into an end card. One place is easier to learn.

Still open from rounds 1 and 2:

- **"Quiet" means done and untouched for over an hour.** This matches
  workmux's default.
- **The walk order is most recent change first.** Without the host time,
  the fallback is the rail's order.
- **The shortcut is Alt+↓ and Alt+↑.** On macOS, Option+↓ in the composer
  then stops moving the cursor to the end of the paragraph.
- **Folds are not persisted** across a reload.
- **workmux's own status files are not read.**

## Questions for Jari

The per-round questions are at the end of each NOTES.md. The main ones:

1. 3a: Nimi, Aika or Tieto? The recommendation is Tieto.
2. 3b: Heti, Työssä or Valmiina? The recommendation is Työssä.
3. Should the host's last-change time go ahead now? Both rounds depend on
   it.
4. Cross-device "seen" as its own decision issue? Without it, Lopussa does
   not move when a reply is read on the phone.
