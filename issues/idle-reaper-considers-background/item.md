---
created: 2026-10-27
updated: 2026-10-27
type: improvement
reporter: jari
status: obsolete
priority: normal
provenance: chat
source_ref: chat:2026-10-27/idle-reaper-considers-background
lane: agent-lifecycle
lane_seq: 2
preparation: ready
blocked_by: ['@agent-worker-wait-model']
closed: 2026-10-27
---

# Idle reaper keeps an agent that owns live workers or processes

## Description

Jari 2026-10-27 on pi-stop-cause-overnight (the daemon's idle reaper stopped the conductor's Pi 10 minutes after its last turn although five of its Taskfleet workers were still running): 'tässä pitäisi huomioida myös workerit ja prosessit.' Decide and implement how the idle reaper treats a Pi whose conversation owns live Taskfleet runs or live background processes (keep it, extend the idle window, or stop it but keep enough to resume), with bounded resource use per user. Coordinate with agent-worker-wait-model's findings if they land first. List choices under Decisions for later review.

## Decisions

### 2026-10-27T07:40:52Z · @jari

Jari 2026-10-27 valitsi agent-worker-wait-model-suosituksen A: tyhjäkäynnin pysäytys pysyy ennallaan (odotus pitää Pi:n hengissä). Ei toteuteta.
