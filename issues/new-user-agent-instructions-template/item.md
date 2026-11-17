---
created: 2026-11-17
updated: 2026-11-17
type: feature
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-11-17/new-user-agent-instructions-template
preparation: pending
---

# New account starts with a template for the person's own agent instructions (Pi AGENTS.md, Claude CLAUDE.md)

## Description

Jari 17.11.2026: when Open Habitat creates a new user, it could create a starting template for the person's own global agent instructions: ~/.pi/agent/AGENTS.md and/or the corresponding Claude files (~/.claude/CLAUDE.md). To be considered: what goes in it (who the person is, language, how they want answers, which of their own context is useful), how it relates to what Habitat already injects into every conversation (the Open Habitat environment block) so nothing is duplicated or contradicts it, one shared file vs per-harness files, existing accounts (offer, never overwrite), and whether the person or their agent fills it in through a guided first conversation.
