---
created: 2026-10-27
updated: 2026-10-27
type: task
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-27/agent-worker-wait-model
lane: agent-lifecycle
lane_seq: 1
preparation: ready
---

# Design: how an agent and its workers wait for each other

## Description

Jari 2026-10-27: 'Isompi ongelma oli se, että workereitä ei odotettu. Tässä pitäisi olla pohditumpi linja agentin ja sen workereiden välillä. … tää meidän run wait -tyyppinen toiminnallisuus pitäisi miettiä nyt kunnolla. En siis sano, mikä on oikein ja mikä väärin, vaan että pohdittaisiin tätä.'

Today the parent agent learns of a worker's completion only if it has itself started a blocking taskfleet run wait as a background process with wake-on-exit; if it forgets to re-arm after one settles (as on 2026-10-26, pi-stop-cause-overnight), nothing wakes it, the idle reaper stops it, and completions are only reported at the person's next message. Think this through as a design: who owns the relation between a conversation and its runs (Taskfleet, the daemon, the agent's own process), how completion reaches the agent (agent-held wait, daemon-observed runs, Taskfleet notify, Pi extension events), how it interacts with the idle reaper, stopped agents, restarts and upgrades, what the person sees, and what native tools already offer, without building a parallel run registry (root AGENTS.md: reuse native components). Write 2–3 options with trade-offs and a recommendation in result.md (Finnish); architecture choices go to Jari. No implementation.

## Result

Design study (Finnish): [result.md](result.md). Recommendation A (the companion reminds at turn end when own live runs have no wait); the choice between A, B and C is Jari's.
