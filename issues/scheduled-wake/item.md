---
created: 2026-11-17
updated: 2026-11-21
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-17/scheduled-wake
lane: scheduled-wake
lane_seq: 1
preparation: ready
---

# Scheduled wake: the agent waits in Hiljaiset and is woken into Sinun vuorosi at a set time

## Description

Jari 17.11.2026: a new feature building on agent-sets-rail-state. The agent can schedule its own wake: the conversation drops to Hiljaiset to wait, and at the scheduled time the agent is woken and the conversation rises to Sinun vuorosi. (Example uses: 'remind me on Thursday', 'check the backup on 19.11.', follow-ups after a waiting period.) Next action: prototype rounds; where the server side is not obvious, a sketch of how the host would schedule and wake (daemon timer surviving restarts/reboots, waking a stopped Pi with a message, archived/stopped conversations, time zones).

## Decisions

### 2026-11-21T06:51:31Z · @jari

Jari 21.11.2026 on round 1: direction 1 Aika rivillä — the rail row with the wake time and the bar look good. The person never sets a wake directly; it is always asked from the agent. The timer lives in the person's own systemd user manager. Archiving a conversation with a pending wake cancels it after a confirmation dialog; prototype that dialog. Limits: Jari asked why they are needed; the conductor proposes a single generous runaway guard instead of the round's list (see below).

### 2026-11-21T06:53:43Z · @jari

Jari 21.11.2026 on limits: a limit is fine as a guard against a runaway agent, but not as tight as round 1 proposed. Decision: one generous cap of 100 pending wakes per person with a clear error to the agent; no per-conversation or date limits; no recurrence in the first version (scope, not a limit).
