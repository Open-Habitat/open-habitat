---
created: 2026-11-17
updated: 2026-11-21
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-17/new-user-agent-instructions-template
preparation: ready
lane: agent-instructions
lane_seq: 1
---

# New account starts with a template for the person's own agent instructions (Pi AGENTS.md, Claude CLAUDE.md)

## Description

Jari 17.11.2026: when Open Habitat creates a new user, it could create a starting template for the person's own global agent instructions: ~/.pi/agent/AGENTS.md and/or the corresponding Claude files (~/.claude/CLAUDE.md). To be considered: what goes in it (who the person is, language, how they want answers, which of their own context is useful), how it relates to what Habitat already injects into every conversation (the Open Habitat environment block) so nothing is duplicated or contradicts it, one shared file vs per-harness files, existing accounts (offer, never overwrite), and whether the person or their agent fills it in through a guided first conversation.

## Decisions

### 2026-11-21T08:04:19Z · @jari

Jari 21.11.2026: prototype it. The person lands in a first conversation that is part of onboarding, where the chat is held and the agent writes the person's own instructions. He wants to see what it looks like and what is asked; it must be tested. Conductor recommendations taken into the round: one shared file both harnesses read (Claude file points to it), nothing duplicated from Habitat's own environment block, existing accounts offered the same conversation without overwriting.
