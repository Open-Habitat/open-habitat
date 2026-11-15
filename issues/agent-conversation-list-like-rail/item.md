---
created: 2026-11-15
updated: 2026-11-15
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-15/agent-conversation-list-like-rail
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-15
---

# Agent conversation list shows only daemon handles, not the rail's conversations

## Description

Jari 14.11.2026 (test server, `conversation-list-title`): titles in
`open-habitat agent conversation list` are right (a person's own name wins),
but the list varies: the first run showed six conversations including
stopped ones, a few minutes later only the two running ones, while the
sidebar still showed the others. The help says "List daemon handles": it
lists the daemon's in-memory handles, not the rail's conversations, so the
agent cannot find a conversation that has dropped out of the daemon's
memory.

Conductor's decision (default, revisitable): the command lists the same
conversations as the sidebar (from native history), with a field saying
whether each is live, resting or archived; the help says so.
