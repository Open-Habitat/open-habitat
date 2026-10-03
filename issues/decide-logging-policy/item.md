---
created: 2026-10-03
updated: 2026-10-03
type: task
reporter: jari
status: open
priority: normal
related: ['@design-logging-policy', '@rewrite-architecture-docs']
lane: logging-design
blocked_by: ['@rewrite-architecture-docs']
---

# Decide and implement the logging policy

## Context

`docs/logging.md` is a recommendation awaiting Jari's decision, not a description of how the system logs today. The documentation rewrite (@rewrite-architecture-docs) removes proposals from `docs/`, so the proposal moves here and the page is deleted. The earlier `design-logging-policy` task produced the proposal and is closed; this issue carries the decision and its implementation.

## Task

1. Move the full text of `docs/logging.md` into this issue directory as `proposal.md` (the rewrite issue does this step and deletes the page).
2. Jari decides the three open choices the proposal lists: the authenticated cross-component attempt-ID protocol versus time-window correlation, retention and access budgets, and whether users get an opaque support reference. Record the decision under `## Decisions`.
3. Implement the decided policy in gateway, broker and daemon, with the leak tests the proposal describes.
4. Describe the result in the architecture documentation as current behaviour: what each component records, what is never recorded, and where logs live. Host-specific retention and access settings go to Fleetrepo.

## Acceptance

- `docs/` contains no logging proposal; the decision is recorded here.
- Gateway, broker and daemon emit the decided event vocabulary and nothing excluded by it; the synthetic leak tests pass.
- The architecture docs describe logging in the present tense.
