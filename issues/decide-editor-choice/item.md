---
created: 2026-10-21
updated: 2026-10-21
type: task
reporter: jari
status: open
priority: normal
lane: editor-choice
lane_seq: 1
related: ['@research-shell-editor', '@implement-workspace-editor']
collision: [docs/decisions]
preparation: ready
---

# Decide: selectable workspace editor (VS Code, Monaco, CodeMirror 6) and a daemon file API

## Description

Jari 2026-10-21: we need to test different editors. Add a settings page where the person chooses the editor: the current VS Code (code-server), Monaco, or CodeMirror 6. Decide the architecture in an ADR first, then implement per its recommendations.

Agreed with Jari (2026-10-21):
- Monaco and CodeMirror 6 read and save through a narrow daemon file API: running as the person, confined to the open workspace, size-limited, no symlink escape, and a save detects that the file changed in between (e.g. the agent wrote it) instead of silently overwriting. Both editors share it.
- A settings page 'Editori' with the three options.
- Opening the editor, full window and conversation file links work the same whichever editor is chosen.
- On phones only CodeMirror 6 is available (Monaco and VS Code do not support phones).
- Default is CodeMirror 6 (the lightest).
- Where the choice is stored: conductor's recommendation was browser-local per signed-in identity (no new host store); the ADR may decide otherwise with reasons.

Prior research: issues/research-shell-editor/report.md (recommended daemon file API + CodeMirror 6).

## Decisions

### 2026-10-21T17:47:00Z · @jari

Jari 2026-10-21: make a technical decision first and proceed per its recommendations; narrow daemon file API is the right approach; settings page, same open/full-window/file-link behaviour, CodeMirror only on phones, CodeMirror 6 default.
