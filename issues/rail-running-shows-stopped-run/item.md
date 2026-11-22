---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-rail-running-shows-stopped-run
lane: unlaned
lane_seq: 1
preparation: ready
---

# Rail: a failed worker run still shows in Käynnissä

## Description

Jari (22.11.2026): a worker run that has failed and stopped (e.g. a failed spinoff of the conversation) still appears in the rail's Käynnissä section, as if work were going on. A stopped/failed run should move the conversation out of Käynnissä (to Sinun vuorosi if it needs the person). Next action: analyse which signal keeps it there (taskfleet status vs. retained work vs. the agent's section choice) and fix.
