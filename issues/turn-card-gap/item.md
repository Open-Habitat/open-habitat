---
created: 2026-11-28
updated: 2026-11-28
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: maintainer observation
source_ref: taskfleet:01m8g6mdp58e7kxtvpj9ggnygd/turn-card-gap
originating_run: 01m8g6mdp58e7kxtvpj9ggnygd
originating_run_kind: spinoff
closed: 2026-11-28
commits:
- hash: 8182e7982
  summary: give turn cards the feed's gap
---

# Turn cards sit 3px below the reply above them

## Description

A card under an agent turn (the server browser card and the Muutokset card,
both `.ah-turn-changes`) sits 3px below the reply above it. The card has no
margin of its own, so the only space is the turn grid's `row-gap`
(`--ah-turn-gap`, 3px), which is meant for the turn's tight rows (work rows,
interim and final replies). The card reads as glued to the reply.

Expected: the card keeps the feed's gap (`--ah-feed-gap`, 8px) from the row
above, the same spacing as between messages, on desktop and phone, without
doubling the gap between two cards or changing the turn's other rows.

Reproduce in the synthetic lab: a turn with a finished reply followed by a
browser card or a Muutokset card; measure reply bottom to card top.

## Resolution

### 2026-11-28T04:35:45Z · @issuectl

Cards under a turn keep --ah-feed-gap (8px) from the row above; verified in the lab on desktop and phone.
