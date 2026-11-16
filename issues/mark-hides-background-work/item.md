---
created: 2026-11-14
updated: 2026-11-16
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-14/mark-hides-background-work
preparation: pending
lane: rail-mark
lane_seq: 1
---

# The read mark hides background work; a non-waking process is visible nowhere

## Description

Jari 14.11.2026 (test server): the agent left `python3 -m http.server`
running and ended its turn. The row was correctly in Sinun vuorosi, but the
mark showed the read state (no sign of the running background service):
`web/src/components/markState.ts` `agentMark` returns `read` before it looks
at `waiting_background`, so background state is always hidden once the reply
is read. The older promise ("grey ring, hint Taustalla käynnissä: name",
`rail-background-service-not-running`) is not kept by the new mark.

Same with a `sleep 900` started without a wake (notify all `ignore`): the
read mark was identical to a conversation with no background work. After
Ei nyt the row went to Hiljaiset (as `rail-open-moves-turn-to-running`
intends, since the agent does not wait on it), and Käynnissä said "Mikään ei
ole käynnissä" while the process ran on the server. A non-waking background
process is visible nowhere in the rail.

Decisions for Jari: should the read mark also show background work (dimmed
resident, wandering door) or is the hint enough; and should a non-waking
background process be visible in the rail at all, and where.

## Decisions

### 2026-11-16T13:05:51Z · @jari

Jari 16.11.2026: the small background-service dot at the end of the rail row is fine as it is. Next action: a prototype round exploring whether background work could be shown in the Open Habitat mark at the start of the row (the mark that already animates the conversation's state) instead of, or alongside, the dot.
