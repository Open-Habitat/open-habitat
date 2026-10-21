---
created: 2026-10-21
updated: 2026-10-21
type: feature
reporter: jari
status: open
priority: normal
lane: editor-header
lane_seq: 1
related: ['@proto-editor-buttons']
collision: [web/conversation-header]
preparation: ready
size: M
---

# Editor controls in the editor's own header, icon-only

## Description

Implement Jari's choice from proto-editor-buttons round 2 (direction 2, "Oma otsake"; see issues/proto-editor-buttons/result.md and design-system/prototypes/rounds/2026-10-21-editorin-painikkeet-2/).

The conversation header stays in the right-hand conversation as in production. Opening the editor is its editor icon; full-window and close live in the editor's own top-right corner and stay visible in full-window mode. Editor controls are icon-only using the existing production icons (`editor`, `forward`, `back`), with accessible names and tooltips. Return from full window both from the control and from the conversation strip. 390 px: panes stack, conversation and composer remain reachable.

Done: production components (Navigation.tsx AgentHeader, WorkspaceEditor / EditorHeaderControls, EditorSplit) with stories, tests per TESTING.md; KOKEILTAVAA.md entry.
