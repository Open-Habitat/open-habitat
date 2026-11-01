---
created: 2026-11-01
updated: 2026-11-01
type: improvement
reporter: jari
status: open
priority: normal
lane: editor-header-one-row
lane_seq: 1
preparation: ready
---

# Editor's top bars into one row

Jari 30.10. (pilot.536, desktop): the editor's *CodeMirror 6* row holds back, full screen and X buttons, and below it a separate row holds the eye (preview) and save. Put everything in one row. Then the conversation header beside the editor could be full width again: now the conversation header next to the editor fits only *V.* and has no real content (`web/src/app/WorkspaceEditor.tsx`, `account-button-hidden-with-editor`, `conversation-header-shorten`). Screenshots at device scale factor 2 before and after in `result.md`. Not gated.
