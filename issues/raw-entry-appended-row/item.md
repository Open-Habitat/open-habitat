---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: conversation-ui
lane_seq: 3
collision: [web/src/components/conversation-message]
closed: 2026-10-23
---

# Conversation shows raw {"type":"entry_appended"} as 'Muu agentin viesti'

## Description

Jari 2026-10-23 10:44: a conversation with the agent started with a collapsed row "Muu agentin viesti" whose content is `{"type":"entry_appended"}`. That is a native Pi event the browser does not understand, rendered as raw JSON. Find where unknown/internal Pi events become visible rows; internal bookkeeping events (like entry_appended) must not be shown at all, and any genuinely unknown event should be logged, not dumped to the person.

## Acceptance Criteria

- [x] No raw JSON rows for internal Pi events; regression with a synthetic session containing entry_appended and other bookkeeping events.
