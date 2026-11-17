---
created: 2026-11-17
updated: 2026-11-17
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-17/multiplayer-conversations
lane: multiplayer
lane_seq: 1
preparation: ready
---

# Multiplayer: several people take part in the same conversation with the agent

## Description

Jari 17.11.2026: start designing multiplayer: several people participating in the same conversation with the agent, possibly more broadly. Steps he named: (1) a worker benchmarks comparable solutions; (2) decide how API keys and quota go, i.e. whose quota the conversation uses (his first thought: the person who opened the conversation); (3) architecture: how this fits Open Habitat nicely (per-person Unix users, daemon per person, native Pi sessions, workspaces under each person's ~/src, gateway authority); (4) prototype the user interface and behaviour.

Per AGENTS-WORKFLOW, the benchmark is material for discussion, not a plan; each proposal coming out of it is designed with Jari. Participation by real people and fundamental architecture are Jari's decisions.
