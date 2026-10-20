---
created: 2026-10-20
updated: 2026-10-20
type: feature
reporter: jari
status: open
priority: high
lane: attachments
lane_seq: 1
collision: [attachments]
---

# Attach files and screenshots to a message (drag and drop, paste, picker)

_Source: chat:ville-requests-2026-10-20_

## Description

Ville (2026-10-20): 'Miten tähän saa screenshotteja?' Jari: screenshots and files must be drag-and-droppable into the conversation, and the agent must accept attachments. Jari uses CleanShot (copy to clipboard / drag the thumbnail), Ville keeps screenshots in Downloads/Documents.
Deliver: drop onto the conversation or composer, paste from clipboard (images), and an attach button with a file picker, also on phone (camera/photos via the picker). Files are uploaded through the gateway to the person's own daemon and stored as the person outside repositories (e.g. ~/attachments/<conversation-or-date>/, decide and justify; never inside a git working tree unless the person asks), with size limits and quota respected. The message carries the attachment: images go to Pi as native image input where the model supports it, other files as paths the agent can read; the bubble shows thumbnails/chips. No new store of truth: the files on disk are the record. Contract changes in contracts/v1. Security: uploads are per-user, content-type sniffed, no path traversal, no serving back without auth. Done: browser tests for drop, paste, picker; Pi receives an image and answers about it in the synthetic lab where available; host context tells the agent where attachments live.
