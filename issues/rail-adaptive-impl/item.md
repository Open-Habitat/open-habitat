---
created: 2026-11-22
updated: 2026-11-22
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-rail-adaptive-impl
lane: rail-space
lane_seq: 2
preparation: ready
closed: 2026-11-22
commits:
- hash: 3fba314bc
  summary: 'feat(web): adaptive rail behind an experimental switch'
- hash: e819791a2
  summary: 'fix(web): keep the adaptive rail''s focus and selected workspace in sight'
---

# Adaptive rail: height shared by utility thresholds, wider rail (experimental)

## Description

Implement the accepted adaptive rail (rail-space-small-screens round 3, Jari 22.11.2026:
C Leveämpi with B's conversations-first logic), behind an experimental feature.

## Resolution

### 2026-11-22T15:55:28Z · @issuectl

Landed behind the adaptive-rail experimental switch; result.md lists the decisions for later review.

## Decisions

### 2026-11-22T18:00:39Z · @jari

Jari 22.11.2026: graduate the adaptive rail from experimental to the default (remove the adaptive-rail switch; the adaptive rail is the rail).
