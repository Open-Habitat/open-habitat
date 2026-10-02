---
created: 2026-10-02
updated: 2026-10-02
type: task
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m3x4p1t2nr61qyw6cz2cwrcm/implementation-slice:paging
originating_run: 01m3x4p1t2nr61qyw6cz2cwrcm
originating_run_kind: technical-decision
---

# Add native tail-first and backward history paging

## Description

## Goal

Implement ADR 0008 tail-first bounded history page and older-page cursor with native revision and stale-precondition semantics. Keep Pi JSONL authoritative, bounded selected-file reads and content caps; test rewrites, large entries and paging races.

## Acceptance criteria

- [ ] Follow proposed ADR 0008 only after Jari accepts its architecture.
- [ ] Add focused synthetic boundary and performance evidence.
