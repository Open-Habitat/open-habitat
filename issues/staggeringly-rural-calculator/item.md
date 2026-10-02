---
created: 2026-10-02
updated: 2026-10-02
type: task
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m3x4p1t2nr61qyw6cz2cwrcm/implementation-slice:journal
originating_run: 01m3x4p1t2nr61qyw6cz2cwrcm
originating_run_kind: technical-decision
---

# Unify browser journal stream per identity

## Description

## Goal

Implement ADR 0008 single per-tab user-wide cursor and stream, global gap/instance/identity invalidation, stale presentation and write gating. Validate same-UID ordering and two-identity isolation using synthetic host tests. No new daemon state.

## Acceptance criteria

- [ ] Follow proposed ADR 0008 only after Jari accepts its architecture.
- [ ] Add focused synthetic boundary and performance evidence.
