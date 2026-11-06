# Result: named support workers

## Round 3: the Avustajat chip's own icon

Round `design-system/prototypes/rounds/2026-11-06-nimetyt-workerit-3/`
(its `NOTES.md` is the Finnish walk-through). Screenshots at device scale
factor 2 are in `evidence/`, named `r3-<riff>-<step>-<width>-<theme>`, for
every step at 1440 and 390, light and dark. Steps with the chip closed
(`0-oletus`, `2a-valittaa-kiinni`, `3b-tyoskentelee-kiinni`, `4-raportti`)
also have a close-up of the strip row, `-lahi-`.

- **1 Botit**: kaksi agentin päätä limittäin, kuten tuotannon Käyttäjät-ikoni on kaksi henkilöä; avustajia on joukko.
- **2 Silmukka**: Workerit-pallon haaraikoni, jonka haara palaa päälinjaan ja jonka silmukalla on worker; kierros palaa mainiin.
- **3 Nimilappu**: agentin pää ja nimilappu; nimetty agentti erottuu nimettömästä kertaworkerista.

Axis: the shape of the icon in round 2's chosen riff 3, the one Avustajat
chip beside the Workers pill. Everything else is that riff unchanged: the
story, the state marks, the list and production's `WorkerView`. Each icon
follows production `Icon` rules (24 grid, 1.8 stroke, round caps and joins,
no fill), so the chosen one moves into `Icon.tsx` as one more name. It sits
in the chip at the pill icon's 14 px (`ah-bg-kind-ic`) and is muted when
every named worker is quiet, as the production pill's icon is. It also
heads the opened list, as production panel tabs carry their kind icon. The
review bar has an icon sheet with the riff's icon at 14, 16, 18 and 24 px
beside the production icons it lives with (Workers, Processes, Agent, Users).

The icon does not change with state. State stays in the marks after it:
a still ring waits, a turning ring is with the main agent (relaying), a
breathing dot works, and a ring with a filled centre is a round report not
yet seen. The check verifies each of these in the closed chip.

### Host facts the view assumes

None beyond round 2: the icon is static UI. The chip still needs round 2's
named-worker facts (parent conversation, state, rounds, relayed message,
stop) from `design-named-workers`.

### Recommendation

**1 Botit.** It is the one that reads at 14 px without explanation: an agent
icon, more than one. It also follows a pattern production already has
(`user` → `users`), so it reads as one family with the Agent icon. 2 Silmukka
says the most about how a named worker works, but at chip size it is a small
knot beside the Workers pill's own branch icon, and the two are easy to mix
up. Its first draft looked like a flag and was redrawn. 3 Nimilappu is precise
but its tag shrinks to a smudge at 14 px. The chip already says *Avustajat*
in words, so the icon only has to say "agents", and Botit does that best.

### Decisions for later review

- **The chip keeps its *Avustajat* label on the phone too**, as chosen in
  round 2. Production's Workers pill is icon and marks only. With an icon of
  its own, the chip could drop the word on the phone to match. That is not
  drawn.
- **Silmukka's first draft was redrawn.** A main line with a D-shaped arc
  read as a flag at 14 px. The drawn version keeps the `branch` icon's top
  node and loops the branch back into the main line.

### Not verified

- The icon sheet is a review aid only; no production surface other than the
  chip and the list title uses the icon here.
- Forced-colours and high-contrast modes were not checked.

### Questions for Jari

1. Which icon: `r3-1-botit-0-oletus-lahi`, `r3-2-silmukka-0-oletus-lahi` or
   `r3-3-nimilappu-0-oletus-lahi` (`-1440-light`)?
2. Is the icon too close to the Workers pill's branch icon in Silmukka
   (`r3-2-silmukka-3b-tyoskentelee-kiinni-lahi-1440-light`)?
3. Does the phone chip need the word *Avustajat*, or is icon and marks
   enough, as on the Workers pill (`r3-1-botit-0-oletus-390-light`)?

### View

```
cd ~/src/open-habitat
node design-system/prototypes/rounds/2026-11-06-nimetyt-workerit-3/build.mjs
tw browser-open design-system/prototypes/dist/nimetyt-workerit-3/offline.html
```

`check.mjs` (in the round) passes 672 checkpoints with a clean console.

## Round 2: named workers by the Workers pill

Round `design-system/prototypes/rounds/2026-11-06-nimetyt-workerit-2/`
(its `NOTES.md` is the Finnish walk-through). Screenshots at device scale
factor 2 are in `evidence/`, named `r2-<riff>-<step>-<width>-<theme>`, for
every step at 1440 and 390, light and dark.

- **1 Pallossa**: avustajat ovat Workerit-pallossa omina merkkeinään, ja pallon paneelissa niillä on oma ryhmä kertaworkerien yllä.
- **2 Sirut**: jokainen avustaja on oma sirunsa pallon vieressä nimellä ja tilamerkillä; siru avaa kortin, jossa ovat kierrokset.
- **3 Avustajat**: yksi Avustajat-siru pallon vieressä kertoo kaikkien tilan merkein ja avaa niiden listan.

Axis: where the named workers sit relative to the production Workers pill.
The production `BackgroundStrip` is drawn unchanged, with a one-shot worker
that nobody waits on. The round's named-worker pieces are added into its own
row and panel and use its classes. Opening a named worker shows production's
`WorkerView`. It is read only, has no composer, and its band already says
*Vain luku · kysy pääagentin kautta*. The page calls a named worker an
**avustaja** so that it reads apart from a one-shot worker in the same pill.

The story is the same in every riff. Two named workers wait: Prototyyppari
(M365, two rounds on main) and Katselmoija (one review round). The person
writes *riffaa A1:tä oikeilla kuvakaappauksilla* to the main agent. While
the main agent relays, the prototyper's mark turns (*Pääagentti välittää
viestiä · main päivitetään haaraan*). The main agent then says in the
conversation what it sent, quoting it, and the prototyper works (*Kierros 3
työn alla*). When its report comes in, the mark gets a filled centre until
the person looks. The main agent summarises the report in its own words.
The worker's report text never enters the main conversation. The person
opens the worker's conversation, where each round lands as *Kierros N
yhdistetty main-haaraan* and each message is preceded by *main päivitetty
haaraan ennen viestiä*. Finally the person stops the worker, and its row
folds away.

### Host facts the view assumes

All of these come from Taskfleet's named-worker work (`named-resident-workers`
in the taskfleet repository). Habitat only reads them.

- A named worker belongs to a parent conversation and has a short **name**,
  a task title, its harness and profile.
- Its **state**: working a round, waiting for its parent (production's
  `waiting_parent` word *Odottaa pääagenttia* already fits), relaying (a
  message from the parent is being delivered, main rebased into its branch
  first), stopping.
- Its **rounds**: number, a one-line report summary and the landed commit
  on main, or that the round changed nothing. The card in riff 2 shows the
  commits. The rows in riffs 1 and 3 show only the last round.
- The **last message** the parent sent it, verbatim, with its time.
- Whether a report is **unseen** is browser state per person. It is not a
  host fact.
- Its **native transcript** as `WorkerView` reads it today. It needs
  Taskfleet's round and rebase events in order, so that the view can show
  the landings and the rebases.
- **Stop** as a browser control through the daemon, like production's
  stop-wait control. It ends the worker and removes its worktree and branch.
  This needs a Taskfleet command that the daemon may call as the person's
  Unix user.

### Recommendation

**2 Sirut.** A chip with the worker's own name and mark is what Jari
described: a second pill beside the Workers pill. It is the only riff where
the person can see which worker reported without opening anything. In 1
the marks inside the pill are anonymous, and two still rings look alike.
In 3 the marks hide behind the word *Avustajat*. The chip's card also has
room for what a named worker adds over a one-shot worker: the rounds and
their commits on main, and the exact message the main agent sent. Riffs 1
and 3 have room only for the last round. On a phone, two chips fit beside
the pill with names truncated, and the round badge drops to the mark.
Three or more named workers in one conversation would crowd the row. If
that becomes common, the chips should collapse into riff 3's single
Avustajat chip above a threshold, as production's pill collapses its marks
above five.

### Decisions for later review

- **The word *avustaja***, for named workers in the UI. The alternatives
  were *nimetty worker*, which is long and technical, or no separate word,
  which would mix them with one-shot workers in the same pill.
- **Stop is a direct browser control, not a request through the main agent.**
  Every round is already on main, so stopping loses nothing. It is control
  like production's stop-wait, not a message. While the worker works or the
  main agent relays, Stop is refused and its title gives the reason. The
  alternative was to route stopping through the main agent, like *Kerro
  agentille*.
- **Nothing enters the main conversation when a worker stops.** The row's
  last state says it, and Taskfleet tells the main agent. A stop line in the
  conversation would be the only conversation entry that is not from the
  person or the main agent.
- **An unseen report is a filled centre in the still ring.** Opening the
  worker's conversation clears it. Opening a row or card does not, because
  the full report is only in the worker's conversation.
- **The main agent quotes the message it relayed**, in its own reply. That
  way the person sees what was sent without opening the worker. Riff 2's card
  repeats it.

### Not verified

- Nothing talks to a host. The `fetch` stand-in answers only the process
  inventory, which the production strip reads.
- A failed or interrupted named worker is not drawn. Nor is the 24-hour
  idle expiry, nor three or more named workers.
- `ControlButton` has no `availability` prop. Round 1 passed one, and it
  had no effect, so round 1's disabled buttons were in fact enabled. This
  round uses `isDisabled` and gives the reason in the title.

### Questions for Jari

1. Which riff: `r2-1-pallossa-0-oletus`, `r2-2-sirut-0-oletus` or
   `r2-3-avustajat-0-oletus` (`-1440-light`)?
2. Is the chip's card the right amount (`r2-2-sirut-5-raportti-auki`), or is
   the one-row form enough (`r2-1-pallossa-5-raportti-auki`)?
3. Should Stop sit on the worker row as a direct control
   (`r2-2-sirut-7-lopetettu`), or should stopping go through the main agent?

### View

```
cd ~/src/open-habitat
node design-system/prototypes/rounds/2026-11-06-nimetyt-workerit-2/build.mjs
tw browser-open design-system/prototypes/dist/nimetyt-workerit-2/offline.html
```

`check.mjs` (in the round) passes 496 checkpoints with a clean console.

## Round 1


Round `design-system/prototypes/rounds/2026-11-06-nimetyt-workerit/` (its
`NOTES.md` is the Finnish walk-through). Screenshots at device scale factor 2
are in `evidence/`: every step of today and every direction at 1440 and 390,
light and dark. They are named `<direction>-<step>-<width>-<theme>`.

The scenario is the same everywhere. In the conductor's conversation
*Rupeama 6.11.* the prototyper has delivered round 2 of the M365 setup
(A1/A2/A3, recommends A1). The next message is "riffaa A1:tä oikeilla
kuvakaappauksilla". Round 3 comes back, and the worker is stopped and its
work merged.

### Axis and directions

Axis: where a named worker lives in Habitat.

- **Nyt**: one-shot runs. The round-2 worker landed and is gone, so the request starts a new worker that reads the issue and earlier rounds from the start. It shows in the production Workers strip, and the `taskfleet run wait` completion is the report.
- **A Rivit**: the named worker is a row in a Workers panel above the composer, with its state, its last message, *Kirjoita* (an inline field that writes to it), *Viestit* (the exchange) and *Lopeta ja yhdistä*. In the conversation the report is a compact card and a sent message is one line.
- **B Omat keskustelut**: the worker is its own small conversation, indented under the parent in the rail. The report in the parent is a link card. Its view shows the main agent's task, its replies and the person's own messages, a band back to the parent, *Lopeta ja yhdistä*, and a composer that writes to it.
- **C Keskustelussa**: the worker's replies come into the parent whole, under its name, with *Vastaa* and *Lopeta ja yhdistä*. A *Kenelle: Pääagentti | Prototyyppari* choice above the composer addresses the worker.

In A, B and C the person can also ask the main agent, which says it passes
the message on, and the forwarded message is shown. C's check walks that
route as well.

### Host facts the view assumes

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

### Recommendation

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

### Decisions for later review

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

### Not verified

- Nothing here talks to a host. The round's `fetch` stand-in answers only
  the process inventory, which today's strip reads.
- Several named workers in one conversation are not drawn. A's panel and
  B's rail would list them, and C's *Kenelle* would grow a choice per worker.
- A failed or interrupted named worker is not drawn.

### Questions for Jari

1. Which direction: `nyt-0-oletus`, `a-rivit-0-oletus`,
   `b-keskustelut-0-oletus` or `c-keskustelussa-0-oletus` (all
   `-1440-light`)?
2. Should the worker's report show whole in the parent (`c-keskustelussa-3-raportti`)
   or as a card that opens (`a-rivit-4-raportti`, `a-rivit-5-raportti-auki`)?
3. Do you write to the worker yourself (`a-rivit-2-kirjoita`,
   `b-keskustelut-2-tyoskentelee`), or always through the main agent
   (`c-keskustelussa-5-paaagentin-kautta`)?

### View

```
cd ~/src/open-habitat
node design-system/prototypes/rounds/2026-11-06-nimetyt-workerit/build.mjs
tw browser-open design-system/prototypes/dist/nimetyt-workerit/offline.html
```

`check.mjs` (in the round) passes 244 checkpoints with a clean console.
