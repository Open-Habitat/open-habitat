---
created: 2026-10-13
updated: 2026-10-13
type: task
status: duplicate
priority: normal
provenance: other
provenance_detail: Implementation gap observed during taskfleet worker
source_ref: taskfleet:01m4vf7q6mx5m7vfbpvh4gdv5s/need:empty-conversation-close-endpoint
originating_run: 01m4vf7q6mx5m7vfbpvh4gdv5s
originating_run_kind: spinoff
closed: 2026-10-13
duplicate_of: close-empty-conversation
---

# Provide safe Close operation for an empty native Pi conversation

## Description

The conversation controller has create, stop and archive, but no Close operation. An empty browser-created conversation starts a Pi child immediately; simply removing its sidebar row would leave the child and possibly its native session JSONL. Add an authenticated owner-scoped operation which rejects any session with messages, stops and reaps the child, removes only a verified empty native session if present, invalidates discovery, and reports uncertain failures so the UI can restore the row. Cover absent history, native empty history, started Pi and failure rollback.

## Comments

### 2026-10-13T20:57:40Z · @intake

Duplicate of close-empty-conversation
