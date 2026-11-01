---
created: 2026-11-01
updated: 2026-11-01
type: improvement
reporter: jari
status: done
priority: normal
lane: icon-wish-field-like-composer
lane_seq: 1
preparation: ready
closed: 2026-11-01
---

# Workspace icon wish field works like the conversation composer

Jari 1.11. (pilot.572): the icon suggestions' wish field is a one-line input with a separate *Ehdota* button. Make it as close to the conversation composer as possible: same look and the send button the same way, height grows with the text and may start a little taller, attachments and dictation work. Skills and commands are not needed there and may be disabled in its UI. Reuse the composer component rather than imitate it if that is practical (`web/src/components/WorkspaceIconSuggestions.tsx`; earlier work `workspace-icon-polish`). Workspace icons are experimental; this change follows the feature.
