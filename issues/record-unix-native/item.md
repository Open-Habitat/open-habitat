---
created: 2026-09-19
updated: 2026-09-19
type: task
reporter: jari
status: done
priority: high
epic: native-agent-host-architecture
lane: architecture-docs
lane_seq: 30
closed: 2026-09-19
closed_by: pi
commits:
- hash: bbcb7b59270401822ea62c56a8cd6d5673572a80
  summary: 'docs: adopt Unix-native host architecture'
---

# Record Unix native host architecture

## Goal

Record the architecture decisions accepted in the current user/agent design dialogue before context compaction.

## Deliverables

1. Add accepted ADR `docs/site/adr-0001-unix-native-agent-host.md` covering the federated web-client/server model, per-Linux-user daemon, shared authentication gateway, one web identity to one Unix account per server, workspace discovery from `~/src`, native resume identity for agents, discovery-over-duplication, Unix-user permission model, sparse annotations, no core tenant concept, and JSON/HTTP snapshot/command plus cursor-based SSE event feed.
2. Update `docs/site/decisions.md`, `architecture.md`, `implementation.md`, and `status.md` to integrate the accepted model and retire contradictory v0 assumptions without claiming protocol benchmark results or architecture v1.
3. Add the ADR to `docs/site/glasspad.yaml` navigation and update the architecture epic checklist.
4. Preserve remaining open questions: exact gateway authentication technology, daemon implementation, agent hierarchy presentation fields, process-extension contract, event retention/replay bounds, and application-specific integration.

Validate with `python3 docs/validate-project-view.py`, Glasspad rendering, and `git diff --check`. Publish only after landing.

## Acceptance Criteria

- [x] ADR 0001 records the accepted architecture and remaining open decisions.
- [x] The Project View and architecture epic integrate the accepted model without claiming architecture v1.
- [x] Project View validation and `git diff --check` pass.

## Resolution

### 2026-09-19T06:49:21Z · @pi

Recorded the accepted Unix-native federated host model as ADR 0001 and integrated it into the Project View and architecture epic.
