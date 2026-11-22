---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: open
priority: normal
lane: server-browser-entry
lane_seq: 1
preparation: ready
---

# Prototype: server browser in the rail and in the conversation — both needed?

## Observed

Jari 22.11.2026 trying the experimental server browser: it appears both as a row in the left rail and as a chip in the conversation (above the composer). Are both needed? Prototype it.

## Decisions

### 2026-11-22T06:18:38Z · @jari

Jari 22.11.2026: the OpenAI-built rounds are unusable and are discarded; redo the round with a Claude worker.

### 2026-11-22T07:24:53Z · @jari

Jari 22.11.2026 on round 2 (Claude): direction 2 (browser only in the sidebar; the conversation shows its own agent's browser work) is the right basis, and a request in another conversation is shown in the sidebar rather than above every composer. But riff it further in round 3: what the conversation shows is now far too big. A browser request/activity has to look tidy in three places: (1) the rail's Oma selain item, (2) the conversation's own row in the rail (its own state), and (3) inside the conversation. The visit record card (server-browser-agent-visit-log, direction 2 Kortti, accepted) is part of (3).
