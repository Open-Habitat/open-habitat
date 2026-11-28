---
created: 2026-11-19
updated: 2026-11-28
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-19/scheduled-agent-runs
lane: scheduled-runs
lane_seq: 1
preparation: ready
---

# Scheduled agent runs: work an agent does on a recurring schedule

## Description

Jari 19.11.2026: Open Habitat should have scheduled agent runs. A person sets up work that an agent does on a schedule without anyone starting it, for example a weekly pass that checks whether a project's README and screenshots still match the product and updates them.

This is a neighbour of `scheduled-wake`, where an agent schedules one later wake of its own conversation. Here the schedule recurs and belongs to the person: it should be visible, changeable and stoppable by them, not only something an agent arranged.

Nothing is designed yet. Questions the design has to answer: whether a run is a new conversation each time or a turn in one standing conversation; where the person sees, pauses and removes schedules; what a run may do unattended and how its result reaches the person (Your turn, a notice); what happens to a run that falls during a restart, an upgrade or an exhausted model quota; whether the daemon keeps the timer or a native mechanism (a systemd user timer) does, which the person would also see over SSH; and how much of the host mechanism is shared with `scheduled-wake`.

Next action: discuss with Jari and agree the design before anything is built.

### 2026-11-28 · @jari (via conductor)

Design the concept first (how scheduled runs are managed, where they are listed, who owns them, what a run looks like), then prototype from it.
