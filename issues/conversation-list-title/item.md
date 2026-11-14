---
created: 2026-11-14
updated: 2026-11-14
type: improvement
status: open
priority: normal
provenance: chat
source_ref: conductor:2026-11-14/conversation-list-title
lane: agent-cli
lane_seq: 1
preparation: ready
---

# agent conversation list does not return the conversation's title

## Description

## Observed (14.11.2026)

`open-habitat agent conversation list --json` does not return a conversation's title. An agent looking for a named conversation (for example to send a message to the person's main conversation) had to read Pi's native session files to find it.

## Expected

Each listed conversation carries its title (the same name the rail shows), so agents can find a conversation by name through the supported command.
