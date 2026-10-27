---
created: 2026-10-27
updated: 2026-10-27
type: task
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-27/wake-agent-on-settled-wait
lane: proto-wake
preparation: pending
lane_seq: 1
closed: 2026-10-27
---

# Prototype: waking a stopped agent (typing, visiting, a Herätä button)

## Description

Jari 2026-10-27: 'Voisiko meillä olla herkempiä triggereitä agentin uudelleen käynnistymiselle.' Today a stopped browser Pi is restarted only by the person's next message, and only then learns which spinoffs settled. When a conversation's Pi has stopped (daemon restart, upgrade, crash) while it was waiting on background work (Taskfleet run wait, other wake-on-exit processes), the daemon should start it again when that work settles and hand it the same catch-up notice, so the round continues without the person. Also consider restarting right after a daemon restart when the conversation was mid-turn or had live waits. Design the triggers and their limits (no loops, once per settlement, respect a person's explicit stop, per-user resource limits), implement, and list choices under Decisions for later review. The daemon starts only the signed-in user's own agents, as that user. Builds on pi-stop-cause-overnight's findings.


## Decisions

### 2026-10-27 · @jari

Jari 2026-10-27: not every old conversation should be started automatically when its background work settles. Prototype instead lighter, person-driven triggers: start the stopped agent when the person begins typing in the composer or opens the conversation, or offer a "Herätä" button in the conversation, and whatever else the round finds. Prototype round first (design-system/prototypes method: 2–3 directions, desktop and phone, light and dark, synthetic data); implementation is a later issue. The overnight stop was the idle reaper (pi-stop-cause-overnight).

### 2026-10-27T07:40:52Z · @jari

Jari 2026-10-27 kierroksesta 1: kirjoittamisen aloitus käynnistää agentin on mukava. Painike-suunnan kuvaus (milloin ja miksi pysähtyi, mitä valmistui) on tosi hyvä, mutta siinä raportti tulee vasta, kun agentti käynnistyy uudestaan; sen pitää näkyä jo ennen herätystä. Avatessa-suunnan lähtölaskenta on hölmö, pois. Riffataan näillä (kierros 2). ADR 0020:n muutos (uusi herätysoperaatio) on ok.

### 2026-10-27T08:49:27Z · @jari

Jari 2026-10-27 kierroksesta 2: Kortti, ehdottomasti. Toteutus: wake-stopped-agent (kirjoittaminen herättää, Habitatin oma selostus ennen herätystä korttina, ei lähtölaskentaa). ADR 0020:n muutos hyväksytty.
