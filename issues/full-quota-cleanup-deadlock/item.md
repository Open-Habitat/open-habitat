---
created: 2026-11-16
updated: 2026-11-17
type: bug
reporter: jari
status: fixed
priority: high
provenance: chat
source_ref: chat:2026-11-16/full-quota-cleanup-deadlock
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-17
closed_by: claude
---

# Full storage quota deadlocks cleanup: the agent refuses to work, and asking it is the only way to free space

## Description

Jari 16.11.2026, observed while a user's storage filled up: once the quota was full, the only way to remove data was to ask the agent to delete it, but the agent would not do anything because the disk was full. The person was stuck: no way to free space without the agent, and the agent cannot work without space.

Expected: a person at a full quota can always free space themselves (and/or the agent can still run enough to delete), and the interface says what to do. Related: the experimental storage breakdown (cleanup drafts the agent acts on), the browser's trash and workspace removal flows, the 85 % warning.

## Resolution

### 2026-11-17T06:19:00Z · @claude

Browser deletions work at a full quota; notices point to Storage and Trash. See result.md.
