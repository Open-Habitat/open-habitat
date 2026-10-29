---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: open
priority: normal
lane: experimental
lane_seq: 1
collision: [web/src/app/BrowserConversation.tsx]
preparation: ready
blocked_by: ['@proto-experimental-features']
---

# Experimental: next waiting conversation row after replying

_Source: chat_

## Description

Implement the "next waiting conversation" row from `research-workmux-sidebar` round 3 with Jari's 29.10. choice **Työssä**: after the person replies and the host confirms the agent is working, the next conversation waiting for them appears as a row above the composer. An experimental feature behind its Kokeelliset ominaisuudet switch (off by default), so it waits for the experimental settings section.

## Acceptance Criteria

- [ ] Row appears on the host's working confirmation, opens the next waiting conversation.
- [ ] Behind the experimental switch; browser spec; KOKEILTAVAA line.
