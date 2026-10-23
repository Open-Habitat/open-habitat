---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: conversation-ui
lane_seq: 4
collision: [web/src/components/conversation-message]
---

# Conversation shows raw model metadata rows and no-op model changes

## Description

Jari 2026-10-23 14:08: a new conversation starts with two rows: "Malli · claude-bridge/claude-opus-5-5 · Ajattelu · medium" and "Malli · claude-bridge/claude-opus-5-5 → claude-bridge/claude-opus-5-5". The first is native session metadata, the second a no-op change. Do not render session-start metadata at all (the header already shows the model); render a model/thinking change only when the value actually changes, compactly, with display names (e.g. "Malli vaihtui: Opus 5.5 → Fable 5.1"), never raw provider/model ids.

## Acceptance Criteria

- [ ] New conversations start without metadata rows; real changes show one compact row with display names; no-op changes are silent; regression with a synthetic native session.
