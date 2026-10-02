---
created: 2026-10-02
updated: 2026-10-02
type: task
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m3x4p1t2nr61qyw6cz2cwrcm/implementation-slice:windows
originating_run: 01m3x4p1t2nr61qyw6cz2cwrcm
originating_run_kind: technical-decision
---

# Keep bounded recent conversation windows in browser

## Description

## Goal

Implement ADR 0008 five-window/50-entry and 4 MiB aggregate disposable memory projection for controlled and read-only histories, incremental saved entry/live turn handling, cold spinner, scroll back, and warm no-network switching. Test gap/identity reset, multi-tab turn, request count, heavy render p95 and 16 ms first-paint target in synthetic lab.

## Acceptance criteria

- [ ] Follow proposed ADR 0008 only after Jari accepts its architecture.
- [ ] Add focused synthetic boundary and performance evidence.
