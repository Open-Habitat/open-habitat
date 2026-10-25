---
created: 2026-10-25
updated: 2026-10-25
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
collision: [web/src/app/]
preparation: ready
---

# Stop returns undelivered queued messages to the composer for editing

## Description

Jari, 2026-10-25, Birch, Claude Code conversation in Habitat (screenshot
`~/attachments/f96a6190-c85f-45df-99d7-f99e72c373b7`): he queued a message
while the agent was working, then pressed Stop. The turn stopped; the queued
message appeared at the end of the conversation, followed by the "Keskeytit"
marker, and then the same message appeared again and was sent as a new turn.
He expects that on Stop, queued messages that the agent has not yet received
return to the composer to be edited (or sent again, or discarded), the way
Claude Code's own terminal UI returns queued input on Esc.

Expected:
- Stop with queued, undelivered messages: they leave the conversation and go
  back to the composer (in order, with their attachments); nothing is sent
  until the person sends it.
- A message the agent already received before the stop stays where it is,
  once, and is not resent.
- Same for Pi and Claude Code conversations; no duplicate bubble live or after
  reload.

## Acceptance Criteria

- [ ] Behavior as above, with browser regression tests for both the
  undelivered and the already-delivered case.

