---
created: 2026-10-27
updated: 2026-10-27
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-27/agent-wait-turn-end-reminder
lane: agent-lifecycle
lane_seq: 3
preparation: ready
---

# Remind the agent at turn end about its own live runs that nothing waits on

## Description

Implements agent-worker-wait-model recommendation A (Jari 2026-10-27): the companion extension checks at turn end (agent_before_settle) whether the conversation's own live Taskfleet runs are covered by a live wait; if not, once per uncovered run set, it adds a visible marker offering the ready wait command and lets the agent decline. Taskfleet read bounded to 1–2 s; error or timeout means no reminder. Uses the shared wait grammar (companion-wait-grammar-drift). Read issues/agent-worker-wait-model/result.md.

## Acceptance Criteria

- [ ] Reminder appears once for an uncovered set, not when a wait covers the runs, not on Taskfleet errors; tests at these boundaries
