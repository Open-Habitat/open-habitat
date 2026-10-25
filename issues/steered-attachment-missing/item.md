---
created: 2026-10-25
updated: 2026-10-25
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
collision: [web/src/app/]
preparation: ready
closed: 2026-10-25
closed_by: agent
---

# Attachment missing from the bubble of a message sent while the agent works

## Description

Jari, 2026-10-25, Birch, Claude Code conversation (session run through Habitat):
he sent two messages with a pasted screenshot while the agent was working
(mid-turn, "steered" messages). The agent received both images (native image
input and `~/attachments/<id>` paths in the message text), but his own
message bubble shows only the text, no attachment, so he cannot see the image
afterwards. Screenshot of the second case:
`~/attachments/553a2152-e037-4aa2-8b76-2f2c4b6272a1` (Jari's account on Birch).

Expected: a message's attachments show in its bubble whether it was sent
while the agent was idle or working, live and after reloading the history,
for both Pi and Claude Code conversations.

## Acceptance Criteria

- [x] Cause found and fixed; a regression test at the layer where it broke.

