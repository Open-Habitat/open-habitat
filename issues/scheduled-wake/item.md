---
created: 2026-11-17
updated: 2026-11-17
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-17/scheduled-wake
lane: scheduled-wake
lane_seq: 1
blocked_by: ['@agent-sets-rail-state']
preparation: ready
---

# Scheduled wake: the agent waits in Hiljaiset and is woken into Sinun vuorosi at a set time

## Description

Jari 17.11.2026: a new feature building on agent-sets-rail-state. The agent can schedule its own wake: the conversation drops to Hiljaiset to wait, and at the scheduled time the agent is woken and the conversation rises to Sinun vuorosi. (Example uses: 'remind me on Thursday', 'check the backup on 19.11.', follow-ups after a waiting period.) Next action: prototype rounds; where the server side is not obvious, a sketch of how the host would schedule and wake (daemon timer surviving restarts/reboots, waking a stopped Pi with a message, archived/stopped conversations, time zones).
