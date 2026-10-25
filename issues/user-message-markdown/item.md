---
created: 2026-10-25
updated: 2026-10-25
type: improvement
reporter: jari
status: open
priority: normal
lane: unlaned
collision: [web/src/components/Conversation.tsx]
preparation: ready
---

# Render the person's own sent messages as Markdown

## Description

Jari, 2026-10-25 (screenshot `~/attachments/7d208526-f2d3-49eb-830d-ba5e2b136b34`):
his own sent messages show Markdown as raw text (`**worker**`); after sending,
they should be formatted like the agent's replies.

Keep what the bubble already does: the 8-line collapse with "show whole
message", attachments outside the collapsed text, copy of the original text.
Same safe renderer as assistant Markdown (no raw HTML executes, `docs/product.md`).
Applies live and after reload, Pi and Claude Code conversations.

## Acceptance Criteria

- [ ] Sent user messages render Markdown; copy still yields the original
  text; regression test.

