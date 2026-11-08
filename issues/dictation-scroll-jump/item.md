---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-08
---

# Dictating into the middle of a long text scrolls the field to the end

## Description

Jari 8.11.2026: with a long text in the composer, he dictates (speech input)
into the middle or near the top of it. The dictated text lands in the right
place, but when dictation finishes the text box itself scrolls to the end of
the text, so the insertion point is out of view. The caret and scroll position
must stay at the end of the inserted text. `web/src/components/composer/Dictation.tsx`
and the composer field.
