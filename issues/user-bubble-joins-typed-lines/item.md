---
created: 2026-10-19
updated: 2026-10-19
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: observed by agent in synthetic lab
source_ref: taskfleet:01m59jkrmqyy52w0c548w7xfgm/observation:user-bubble-soft-breaks
originating_run: 01m59jkrmqyy52w0c548w7xfgm
originating_run_kind: spinoff
lane: conversation-view
lane_seq: 3
collision: [web/src/components/conversation]
preparation: ready
closed: 2026-10-19
---

# Own message bubble joins typed lines into one paragraph

## Description

Observed in the synthetic lab while fixing `conversation-claude-glitches` (2026-10-19): a message typed as seven separate lines (single newlines, as one types Enter-with-Shift in the field) is shown in the person's own bubble as one run-on paragraph. Pi receives the text with its newlines; only the browser rendering joins them, because the user bubble renders its text as Markdown, where a single newline is a soft break.

Evidence: `issues/conversation-claude-glitches/evidence/seven-line-message.png` (lab, after the fade fix) shows "Rivi 1 … Rivi 7" flowing as one paragraph. Jari's pilot.231 report spoke of "a seven-line message"; the lines he typed were probably joined the same way.

Impact: a person's own lists, addresses or stepwise instructions lose their visible structure in the conversation, so the bubble no longer shows what was sent. Decide whether the user's own text keeps typed line breaks (e.g. hard breaks for user messages only) while Pi's replies keep ordinary Markdown.

## Acceptance Criteria

- [x] Own bubbles preserve typed line breaks; assistant replies retain Markdown.
- [x] Rendering choice and pasted code/list/link tradeoffs are recorded in result.md.
- [x] Component checks, affected browser spec and synthetic screenshot are verified.
