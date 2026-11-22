---
created: 2026-11-22
updated: 2026-11-22
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-explain-follow-impl
lane: explain-follow
lane_seq: 2
preparation: ready
closed: 2026-11-22
commits:
- hash: 82793a825
  summary: 'feat(web): Explain card follows beside the pointer (experimental)'
---

# Explain mode: the card follows beside the pointer; only F pins it and opens the report

## Description

Implement the accepted Explain mode card (explain-card-follows-pointer, Jari 22.11.2026: A Vieressä).

## Decisions

### 2026-11-22T16:03:25Z · @jari

Jari 22.11.2026: graduate the following Explain card from experimental to the default (remove the explain-follow switch; the following card is how Explain mode works). Done together with explain-f-hint-impl.
