---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: open
priority: normal
lane: sidebar
lane_seq: 1
collision: [web/src/components/Navigation.tsx]
preparation: ready
---

# Compact Ryhmät sidebar row with state ball and time

_Source: chat_

## Description

Implement the compact Ryhmät sidebar row from `research-workmux-sidebar` round 3 with Jari's 29.10. choice **Aika**: each row is one line, the ball tells the state (working, your turn, done, failed) and the row shows the time since the conversation's last change. The host needs the conversation's latest change time (result.md names it as missing).

## Acceptance Criteria

- [ ] One-line rows with state ball and relative time, desktop and phone.
- [ ] The time comes from a native fact (no new store); updates live.
- [ ] Browser spec; KOKEILTAVAA line.
