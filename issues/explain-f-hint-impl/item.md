---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-f-hint-impl
lane: explain-follow
lane_seq: 3
preparation: ready
closed: 2026-11-22
---

# Explain mode: F hint beside Lopeta in the bar; click opens general feedback

## Description

Implement Jari's choice in explain-f-reminder round 2 (22.11.2026): the F hint beside Lopeta in the Explain mode bar, removed from the following card; clicking it opens the general feedback panel.

## Acceptance Criteria

- [x] The bar hint opens general feedback without a selected part; F still opens the pointed part's report.
- [x] The following card is the default, with no experimental switch or stationary-card path (Jari's additional decision, 22.11.2026).
- [x] Focus, draft protection, touch reporting, GitHub handoff and the touched browser journeys pass focused checks.
