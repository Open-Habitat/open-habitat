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
Its `NOTES.md` covers the build and check commands and "What the host
would need" for each direction. The axis is **how the agent's declared
state shows next to what Habitat observes**. All directions share the same
rules about which section a row goes in. The picker also offers **Nyt**,
today's rail for the same conversations.

- **1 Agentin rivi**: the declaration picks the section, and the agent's
  own words appear under the title as a second line ("Odottaa kahta
  workeria", the question). A worker's question shows on the parent row
  ("Korkeusdata kysyi, agentti vastaa"). A stale declaration stays visible
  as muted italics. Observed rows keep one line, so a declaration looks
  different from an observation.
- **2 Sama kieli**: the declaration picks the section and the mark, and
  the row stays one line and looks like an observation. Only a question
  put to the person gets a second line. Stale declarations are dropped
  without a trace.
- **3 Kysymysrivi**: rows as in 2, but each open question is its own
  indented row under its conversation. It sits in Käynnissä while the
  agent handles it and moves to Sinun vuorosi with the conversation when
  the agent asks the person.

**Recommendation: 1 Agentin rivi.** You can read why a conversation is
where it is without opening it. The question is visible as words where the
person decides whether to answer now. A declaration that might no longer
be true says so instead of passing as an observation. Direction 2 is
almost invisible in Käynnissä, because the mark alone does not tell
"waiting for workers" from "working". Direction 3 makes the most of the
worker question, but adds rows to a rail that has been kept to one line
per conversation, and on a phone the question row has room for only a few
words.

The checks covered every direction at 1440 and 390 px in Päivä, Yö and
Kontrasti, plus English (`check.mjs`, 457 checks, clean console). They
also clicked the events: escalation, the person writing, and the workers
finishing.

### Decisions for later review

- **`done` moves the conversation to Hiljaiset even with an unread reply.**
  Alternatives: keep it in Sinun vuorosi as a new reply, or Sinun vuorosi
  with a weaker mark. Reason: "nothing pending" from the agent means the
  person is not needed, and that is the point of the feature. The reply is
  still there at the top of Hiljaiset.
- **Observation wins over a declaration.** A running turn is Käynnissä
  whatever was declared. A declaration counts only while the agent is
  idle. Alternative: let the declaration rule always. Reason: a running
  turn is a fact Habitat sees, while the declaration is the agent's
  description of a moment that has passed.
- **Expiry belongs to the daemon.** The declaration ends when the person
  writes, when a new turn starts (other than the declaring turn), or when
  its condition ends (no working or idle workers). A daemon restart makes
  it stale. Alternative: the agent clears its own state. Reason: an agent
  that forgets would leave the rail lying.
- **The agent may set only its own conversation's state, through the
  existing agent socket.** The person's `turn_mark` (raise, Ei nyt) stays
  separate and the agent cannot touch it. This adds no new authority.
  Alternative: one shared mark. Reason: the raise is the person's act
  (Jari 7.11.2026).
- **Escalating a worker's question is the parent's own `needs-answer`**,
  optionally naming the worker run. Habitat never answers a worker for the
  person. Alternative: route the worker's question straight to the person.
  Reason: Jari's decision in `worker-asks-parent` (14.11.2026) is parent
  first.
- **Command name `open-habitat agent state set|clear --current`.**
  Alternatives: `conversation update --state`, or a `rail` noun. Reason:
  it fits the CLI's noun-verb form, and "rail" names the UI rather than
  the fact.

### Questions for Jari

1. Is Hiljaiset right for `done`, or should a done conversation's unread
   reply still reach Sinun vuorosi?
2. Should a stale declaration be shown at all (direction 1), or just
   dropped (directions 2 and 3)?

Live check: nothing changed on the test server. Open the round's offline
page (worker-results copy) and compare 1/2/3 against Nyt. Then press
*Agentti kysyy sinulta workerin kysymyksen* and *Kirjoitat
Julkaisutiedotteeseen*.
