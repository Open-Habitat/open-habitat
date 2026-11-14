# Design result (14.11.2026)

The design is in [worker-asks-parent/design.md](../worker-asks-parent/design.md),
written together with the worker-question flow because the two meet in the
rail: §2 covers this issue (the `open-habitat agent handoff` command, which
states the agent may declare, what stays Habitat's observation, expiry and
override, trust), §2.4 how a worker's open question and "needs your answer"
combine, and §3 the phasing, where this issue is slice 1 and needs nothing
from Taskfleet.

Nothing is implemented. The issue stays open with preparation pending until
Jari has reviewed the design; its decisions for later review (§5) and open
questions with recommendations (§6) are in the design.

Review: focused self-review against the code (`web/src/app/railNow.ts`,
`internal/daemon/turn_marks_linux.go`, `notices_linux.go`,
`process-extension.mjs`, `process_interrupted_linux.go`).

Live check: no test-server behaviour changed; there is no handoff command to
try yet.

## Prototype round 1 — the rail (14.11.2026)

Round `design-system/prototypes/rounds/2026-11-14-rail-agent-state/`.
It follows the design above (commands, sections, expiry, labels), and its
`NOTES.md` says what each direction needs from that model beyond it. The
axis is **how the agent's declared state shows next to what Habitat
observes**. All directions place rows by the design's rules. The picker
also offers **Nyt**, today's rail for the same conversations.

- **1 Agentin rivi**: the agent's words appear under the title as a second
  line ("Odottaa kahta workeria", the question). A worker's open question
  shows on the parent row ("Korkeusdata kysyy agentilta"). A
  `waiting_workers` that lapsed after a restart stays visible as muted
  italics ("Odotti kahta workeria · niitä ei enää näy") while its reply
  waits. Observed rows keep one line, so a declaration looks different
  from an observation.
- **2 Sama kieli**: rows stay one line and a declaration looks like an
  observation. Only `needs_answer` gets a second line, its text. A lapsed
  handoff disappears without a trace, as in the design.
- **3 Kysymysrivi**: rows as in 2, but each open question is its own
  indented row under its conversation. It sits in Käynnissä while the
  agent handles it and moves to Sinun vuorosi with the conversation when
  the agent escalates.

**Recommendation: 1 Agentin rivi.** You can read why a conversation is
where it is without opening it. The question is visible as words where the
person decides whether to answer now. A lapsed declaration says so instead
of the row silently changing its reason. Direction 2 is almost invisible
in Käynnissä, because the mark alone does not tell "waiting for workers"
from "working". Direction 3 makes the most of the worker question, but
adds rows to a rail kept to one line per conversation, and on a phone the
question row has room for only a few words.

The checks covered every direction at 1440 and 390 px in Päivä, Yö and
Kontrasti, plus English (`check.mjs`, 457 checks, clean console). They
also clicked the events: escalation, the person writing, and the workers
finishing.

### Decisions for later review (round 1)

- **The waiting row counts the workers** ("Odottaa kahta workeria"), where
  the design's label is *Odottaa workereita*. Alternative: the design's
  fixed label. Reason: `spinoffs_working` already gives the count, and it
  tells the person how much is still outstanding.
- **A lapsed `waiting_workers` is shown as lapsed in direction 1.** The
  design places the row by observation without a trace. Alternative: the
  design as it is (directions 2 and 3). Reason: when a row jumps from
  Käynnissä to Sinun vuorosi with no new reply, the person deserves to
  know why. The cost is that the snapshot or railNow keeps the lapsed
  handoff visible until its reply is opened.
- **In direction 1 the question line shows the question itself, without
  the *Kysyy sinulta* prefix.** Alternative: the design's full label on
  the line. Reason: at rail width the prefix leaves room for two words of
  the question. The section heading and the mark already say it is the
  person's turn, and the prefix stays in the row's description for
  assistive technology.

### Questions for Jari

1. Should a lapsed waiting-for-workers declaration be shown at all
   (direction 1), or dropped as the design proposes (directions 2 and 3)?
2. Direction 3's question rows: is a second row per question worth it in a
   rail kept to one line per conversation?

Live check: nothing changed on the test server. Open the round's offline
page (worker-results copy) and compare 1/2/3 against Nyt. Then press
*Agentti kysyy sinulta workerin kysymyksen* and *Kirjoitat
Julkaisutiedotteeseen*.
