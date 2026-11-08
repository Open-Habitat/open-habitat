---
created: 2026-11-08
updated: 2026-11-08
type: improvement
reporter: jari
status: open
priority: normal
lane: worker-badges-proto
lane_seq: 2
blocked_by: ['@proto-worker-badges']
preparation: ready
---

# Worker marks use the rail's balls, with a legend in Explain mode

## Description

Implementation of Jari's decision on `proto-worker-badges` (round 1, **1
Pallot**, 8.11.2026). The prototype is the specification:
`design-system/prototypes/rounds/2026-11-07-workerimerkit/` and
`issues/proto-worker-badges/evidence/r1-1-*`, with `result.md` for host facts.
A worker's mark is the rail's ball (working pulses, your turn yellow, done
green, unfinished red diamond); a worker the agent waits on gets a ring around
it; not waited on is the absence of the ring; *odottaa sinua* is the rail's
yellow everywhere. Same vocabulary in the Workers chip, the panel row and the
rail.

Jari also wants the prototype's legend table (what each mark means) shown in
Explain mode (`web/src/components/explainParts.ts`, `web/src/text/explainMode.ts`)
for the Workers chip and panel. Not gated: it replaces the existing marks.
