---
created: 2026-11-14
updated: 2026-11-17
type: feature
status: open
priority: normal
preparation: ready
lane: rail-agent-state
lane_seq: 1
---

# Let the agent set its conversation's place in the rail through the agent CLI

## Idea (Jari 14.11.2026) — for design, not decided

The rail sorts a conversation into *Sinun vuorosi*, *Käynnissä* and the quiet
ones from what Habitat observes (a running turn, a worker the agent waits
for, a finished reply). The agent itself knows things Habitat cannot see:
that it is only waiting for workers, that a worker has asked it something,
that it needs the person's answer before anything can continue.

Could the agent steer its own place in the rail through the `open-habitat
agent` command line — for example declare "waiting for workers", "needs
your answer: <short question>", or "done, nothing pending" — so the rail
and the person's attention follow what the conversation actually needs?

Questions for the design: which states the agent may set and which stay
Habitat's own observation; how an agent-set state expires or is overridden
when the person writes or a worker finishes; how it relates to
`worker-asks-parent` (a worker's question reaching the parent) and to the
existing rail rules (`rail-background-service-not-running`).

## Decisions

### 2026-11-14T18:38:02Z · @jari

Jari 14.11.2026: the agent only decides its conversation's section through an open-habitat command, in practice whether it is in Sinun vuorosi or Käynnissä. No agent-written text on the row. (Answers the round-1 prototype: none of its text directions; the rail looks as today.)

### 2026-11-17T06:08:44Z · @jari

Jari 17.11.2026: (1) The agent can put its conversation in any of the three sections: Sinun vuorosi, Käynnissä and Hiljaiset (command proposal: open-habitat agent section update --section yours|running|quiet). Hiljaiset is important: Jari has an idea for a new feature that builds on it. (2) This is only about the agent choosing, after writing its reply, where its own conversation sits according to how it judges its own state. No worker-specific logic, no worker questions, no deadlines in Habitat for this. The combined design with worker-asks-parent mixed two things and is replaced for this issue by this decision. Next action: implement part 1 with the three sections.

### 2026-11-17T06:12:21Z · @jari

Jari 17.11.2026: the guidance the agent gets is what matters. Hiljaiset only when there is a reason, e.g. the person asked for it; not on the agent's own judgement that nothing is pending.
