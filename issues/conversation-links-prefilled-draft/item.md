---
created: 2026-11-27
updated: 2026-11-28
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:conductor-2711/conversation-links
lane: conversation-links
lane_seq: 1
preparation: ready
blocked_by: ['@risky-features-settings']
---

# Links that open a new or named conversation with a prepared draft

## Description

Jari 27.11.2026: Open Habitat should support links that open a conversation
with a prepared message. Use case: a message elsewhere (e.g. a notification in
a chat app) carries an actionable link; clicking it opens Habitat in the
browser with either

- a **new conversation in a given workspace (repository)**, or
- an **existing conversation identified by a stable name/slug**,

and the prepared message is in the composer as a draft. Nothing is sent until
the person presses Send.

Agreed next action: a prototype round (UI and flow), before any design of the
link format, authority or agent CLI.
