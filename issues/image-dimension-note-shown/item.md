---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: jari
status: fixed
priority: high
lane: image-note
lane_seq: 1
preparation: ready
closed: 2026-11-02
---

# Pi's image resize note shows in the person's own message

## Description

Jari 2.11. (iPhone): after attaching a phone screenshot, his own message in
the conversation shows "[Image: original 1170x2532, displayed at 924x2000.
Multiply coordinates by 1.27 to map to original image.]" under his text.

Cause: Pi resizes large images and appends a note for the model to the user
message (`formatDimensionNote` in pi-coding-agent's `utils/image-resize`,
exact form `[Image: original WxH, displayed at wxh. Multiply coordinates by
N.NN to map to original image.]`). Habitat renders the native user message
text as is.

The note is for the model, not the person: Habitat should not show it in the
person's own message (history and live), while the native session and what
the model sees stay unchanged. Match the exact Pi form only, on user
messages that carry an image, so a person who types similar text is not
edited. If Pi has a structured marker for it, prefer that.

## Acceptance Criteria

- [x] A message with a resized image shows the person's text and the image, no dimension note, in live view and after reload.
- [x] A unit test with Pi's exact note format; a typed look-alike without an image is shown unchanged.
