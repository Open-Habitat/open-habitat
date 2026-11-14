---
created: 2026-11-14
updated: 2026-11-14
type: feature
status: open
priority: normal
preparation: pending
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
