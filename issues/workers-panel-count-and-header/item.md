---
created: 2026-11-14
updated: 2026-11-14
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-14/workers-panel-count-and-header
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-14
---

# Workers panel count drops to 0 for a waiting worker; parent wait and Pi model shown late or as ?

## Description

Jari 14.11.2026 (test server): a headless worker stuck at a startup prompt
showed as a row in the Workers panel ("agentti odottaa · odottaa vastausta
päätteessä"), but the panel header count went from 1 to 0 as soon as the row
became waiting, and stayed 0 for at least three minutes: the count seems to
count only working workers while the list shows all. At 24 s the row said
"agentti ei odota" although the parent conversation had started `taskfleet
run wait` with the process tool right after creating the run; at one minute
it said "agentti odottaa". The worker's header showed context "◌ ?" and
"Malli ?" for a Pi worker ("Pi · builtin").

Expected: the header count matches the rows (or says what it counts), the
parent's wait is recognised from its start, and a Pi worker's header shows
its model and context once known (or omits unknown fields instead of "?").
