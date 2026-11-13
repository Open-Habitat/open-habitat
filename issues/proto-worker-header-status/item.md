---
created: 2026-11-13
updated: 2026-11-13
type: feature
status: open
priority: normal
preparation: pending
lane: worker-header-proto
lane_seq: 1
---

# Worker view header: Git changes, context fill and model as buttons

## Observed (Jari 13.11.2026)

The worker view's header shows "WORKER", the parent conversation, the
harness and profile ("Claude Code · prototype-opus"), "No changes yet. No
pull request." and a read-only note. It tells little about the worker's
state compared with a conversation's own header.

## Expected

The worker header carries the same kind of at-a-glance information as a
conversation, as buttons: the worker's Git changes (the Git icon and its
count, opening the diff), how full its context is (the context ring), and
its model. Read-only where the worker cannot be changed from the browser.

## Next action

A prototype round for the worker view header (agent's own judgement on
directions; Jari evaluates). Implementation waits for his verdict.
