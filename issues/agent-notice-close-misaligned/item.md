---
created: 2026-11-17
updated: 2026-11-17
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-17/agent-notice-close-misaligned
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-17
---

# Agent notice card: right edge not aligned with the conversation column

## Description

Jari 17.11.2026 (staging installation, dark theme, desktop): the 'Agentin ilmoitus' card in a conversation (header 'Agentin ilmoitus · <date>', close × at the right) is narrower than the replies around it: its right edge stops short of the right edge of the reply cards and the person's message above and below it, and the close button sits accordingly. The notice should share the conversation column's right edge.

## Acceptance Criteria

- [x] Notice card left/right edges match the adjacent reply within 1 px at 390, 800, 1024, 1440 and 1920 px in light/dark themes.
- [x] Close control stays at the card right padding and works by keyboard.
- [x] Extended lab spec passes three repeats; fast web checks pass.
