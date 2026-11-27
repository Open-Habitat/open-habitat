---
created: 2026-11-27
updated: 2026-11-27
type: feature
reporter: jari
status: testing
priority: normal
lane: unlaned
preparation: ready
---

# Reply to a view or file card (experimental)

## Goal

Implement replying to a view or file card as Jari decided on 27.11.2026 (issue
`reply-view-file`, round 1 direction C, prototype
`design-system/prototypes/rounds/2026-11-26-reply-view-file/`), behind the existing
`reply-to-message` experimental switch:

- ↩ always visible in the offer card's corner, the same button as on an agent message's
  corner, on desktop and phone (no hover needed); the card's own icon row moves as the round
  shows.
- In a multi-file offer, every file row in the file list panel has its own ↩ (on a phone it
  closes the panel and focuses the composer).
- The composer quote and the sent message's quote show the **title only** (the offer's title,
  or the file name for a file row); a cut title ends with "…".
- The `<reply-to>` block the server adds tells the agent which offer (and which file) was
  replied to, in English, as round 1's host facts describe.
