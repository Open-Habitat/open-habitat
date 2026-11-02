---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: jari
status: fixed
priority: high
lane: attach-focus
lane_seq: 1
preparation: ready
closed: 2026-11-02
---

# After dropping an attachment the focus leaves the message field

## Description

Jari 2.11.: after dropping a file (an image or anything else) on the
composer, focus is outside the message field. The normal way of working is
to drop the attachment and immediately start talking (dictation) or typing
about it, so after an attachment is added the focus belongs in the message
field, with the caret at the end of what was already written.

Same for every way of adding one: drop, paste, and the *Liitä* picker (after
the file dialog closes). Focus follows the attachment being shown in the
composer (a ready state), not a timer or animation frame — the rule found
in today's load defects (`gate-load-flakes-speech-settings` result.md).

## Acceptance Criteria

- [x] After drop, paste or picker, the message field is focused with the caret at the end of the draft, on desktop; on a phone the picker does not force the keyboard open unless it was open before.
- [x] A test covers drop and picker, and fails without the fix.
