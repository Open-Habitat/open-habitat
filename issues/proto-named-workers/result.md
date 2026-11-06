# Result: named support workers, round 1

Round `design-system/prototypes/rounds/2026-11-06-nimetyt-workerit/` (its
`NOTES.md` is the Finnish walk-through). Screenshots at device scale factor 2
are in `evidence/`: every step of today and every direction at 1440 and 390,
light and dark. They are named `<direction>-<step>-<width>-<theme>`.

The scenario is the same everywhere. In the conductor's conversation
*Rupeama 6.11.* the prototyper has delivered round 2 of the M365 setup
(A1/A2/A3, recommends A1). The next message is "riffaa A1:tä oikeilla
kuvakaappauksilla". Round 3 comes back, and the worker is stopped and its
work merged.

## Axis and directions

Axis: where a named worker lives in Habitat.

- **Nyt**: one-shot runs. The round-2 worker landed and is gone, so the request starts a new worker that reads the issue and earlier rounds from the start. It shows in the production Workers strip, and the `taskfleet run wait` completion is the report.
- **A Rivit**: the named worker is a row in a Workers panel above the composer, with its state, its last message, *Kirjoita* (an inline field that writes to it), *Viestit* (the exchange) and *Lopeta ja yhdistä*. In the conversation the report is a compact card and a sent message is one line.
- **B Omat keskustelut**: the worker is its own small conversation, indented under the parent in the rail. The report in the parent is a link card. Its view shows the main agent's task, its replies and the person's own messages, a band back to the parent, *Lopeta ja yhdistä*, and a composer that writes to it.
- **C Keskustelussa**: the worker's replies come into the parent whole, under its name, with *Vastaa* and *Lopeta ja yhdistä*. A *Kenelle: Pääagentti | Prototyyppari* choice above the composer addresses the worker.

In A, B and C the person can also ask the main agent, which says it passes
the message on, and the forwarded message is shown. C's check walks that
route as well.

## Host facts the view assumes

None of these exist today. Each one is a contract or command decision for
`design-named-workers`.

- **A named worker belongs to one parent conversation**, and has a display
  name, a state (*working*, *waiting for a message*, *merging*, *stopped and
  merged*) and the branch it works on. Today's `Spinoff` has a title and
  Taskfleet states. There is no state for "waits for the next message".
- **The worker's exchange can be read**: each message with its sender
  (main agent, person, worker) and time. Production already reads a
  worker's native transcript for its view (`WorkerView`). That is enough
  for B and for A's *Viestit*. Telling a person's message from the main
  agent's needs the sender recorded somewhere native, not in a Habitat
  store.
- **The report reaches the parent conversation as an entry of its own**:
  something Pi sees that wakes the agent, which the browser can draw as the
  worker's report. Today that entry is the wait completion.
- **The browser can send a message to the worker** as the person's Unix
  user, through the daemon. That is a new command. Today `taskfleet run
  message` reaches Pi workers only, and the browser has no route to it.
- **The browser can stop the worker and merge its branch** in one action,
  and read the result (branch, commits). Today merging is the worker's own
  `run merge` or the main agent's decision. It is never the browser's.

## Recommendation

**A Rivit, with B's view behind the row.** The row puts the named worker
where today's workers already are, so there is no new place to learn. It
keeps the parent conversation readable: the main agent summarises every
report anyway, so C's whole reports say the same thing twice in the same
column. On a phone they push the conversation out of sight. B shows the
whole exchange best and scales to several workers, but every message to
the worker means leaving the conversation the person is working in. B also
puts a second row in the rail for something that is not the person's own
conversation.

So: the A row with state, last message, *Kirjoita* and *Lopeta ja yhdistä*.
*Viestit* opens the worker's own view (B, which production's `WorkerView`
is close to already) instead of A's inline list. B's rail row is dropped.
On a phone A's panel takes a third of the screen while it is open. It
should start closed there, showing state only, as today's pill does.

## Decisions for later review

- **Stop and merge are one action, refused while the worker works.** A
  stopped named worker's branch is merged at once, like a landed one-shot
  run. The alternatives were a separate *Lopeta* that keeps the branch
  (today's preserved-run path), or allowing a stop mid-work. The scenario
  never needs either. The disabled button gives its reason.
- **The vocabulary is production's *Pääagentti*, not "kapellimestari".**
  The worker view already calls the parent that.
- **The person's message to the worker is shown in the parent in every
  direction.** The parent's agent must know what its worker was told, and
  so must a later reader.
- **Today (Nyt) uses production's `BackgroundStrip` and
  `ProcessCompletion` unchanged.** The new worker's elapsed time is
  synthetic (two minutes).

## Not verified

- Nothing here talks to a host. The round's `fetch` stand-in answers only
  the process inventory, which today's strip reads.
- Several named workers in one conversation are not drawn. A's panel and
  B's rail would list them, and C's *Kenelle* would grow a choice per worker.
- A failed or interrupted named worker is not drawn.

## Questions for Jari

1. Which direction: `nyt-0-oletus`, `a-rivit-0-oletus`,
   `b-keskustelut-0-oletus` or `c-keskustelussa-0-oletus` (all
   `-1440-light`)?
2. Should the worker's report show whole in the parent (`c-keskustelussa-3-raportti`)
   or as a card that opens (`a-rivit-4-raportti`, `a-rivit-5-raportti-auki`)?
3. Do you write to the worker yourself (`a-rivit-2-kirjoita`,
   `b-keskustelut-2-tyoskentelee`), or always through the main agent
   (`c-keskustelussa-5-paaagentin-kautta`)?

## View

```
cd ~/src/open-habitat
node design-system/prototypes/rounds/2026-11-06-nimetyt-workerit/build.mjs
tw browser-open design-system/prototypes/dist/nimetyt-workerit/offline.html
```

`check.mjs` (in the round) passes 244 checkpoints with a clean console.
