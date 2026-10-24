---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: worker observation in the synthetic lab
source_ref: taskfleet:01m5p82se1b3tv01fgfqw9xccz/observation:title-attachment-markdown
originating_run: 01m5p82se1b3tv01fgfqw9xccz
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-10-24
---

# Conversation title shows attachment Markdown when it falls back to the first message

## Description

# Conversation title shows attachment Markdown when it falls back to the first message

## Observation

Synthetic lab, 2026-10-24, while capturing `composer-attachment-chip`: after sending "Mikä tässä näkymässä on vialla?" with a screenshot and a CSV attached, the sidebar and the conversation header read `Mikä tässä näkymässä on vialla? ![Cle…`. The lab has no title generator, so the displayed title is the first user message as stored, which ends with the attachment reference lines (an image or file reference to an `/api/v1/attachments/` URL) and the host's `Attachment path:` lines.

The composer and the sent message no longer show these (`composer-attachment-chip`), so the title is now the remaining place where a person sees the agent-facing reference text. On a host where title generation is unavailable, slow or fails, live conversations would show the same.

## Expected

A title derived from the message text leaves out attachment reference lines and the host's `Attachment path:` lines, the way the sent bubble does (`messageText` in `web/src/components/AttachmentChips.tsx`). Whether this belongs in the browser's display of the fallback title or in the daemon's fallback/title excerpt (`internal/daemon/title_linux.go`) is open; a generated title may also echo file names, which is fine.

## Acceptance Criteria

- [x] First-message fallback titles omit whole-line attachment references and their matching host paths before truncation, without removing ordinary message content.
