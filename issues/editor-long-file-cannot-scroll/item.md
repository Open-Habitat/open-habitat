---
created: 2026-10-22
updated: 2026-10-22
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: editor-tree
lane_seq: 2
collision: [web/src/components/editor-files]
---

# Editor: long files cannot be scrolled down

## Description

Jari 2026-10-22 on 1362b57f: in the editor (CodeMirror), a file longer than the viewport cannot be scrolled down. Likely a height/overflow regression from the editor header or the new file tree layout (`implement-editor-header`, `implement-filetree-viivasto`). Check both the normal and maximized editor, desktop and 390 px, mouse wheel, trackpad, keyboard (Ctrl+End, PageDown) and touch.

## Acceptance Criteria

- [ ] Long files scroll to the end in every editor layout; a browser test asserts the last line becomes visible.
