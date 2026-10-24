---
created: 2026-10-24
updated: 2026-10-24
type: task
reporter: jari
status: in-progress
priority: normal
preparation: pending
lane: unlaned
---

# Prototype: concurrent edit between the person and the agent

## Description

Jari 2026-10-24 tested concurrent editing: unsaved changes in the editor while the agent changes the same file, then trying compare and save. It felt odd. Prototype first, before changing production (CodeMirror editor, `implement-editor-files-codemirror` era behaviour). The central design question: does the person understand whose changes remain in force and what Compare and Save do? The observation alone does not show data loss or a technical defect.

Prototype round (method of earlier proto-* rounds, `design-system/process.md`): the current production behaviour as the baseline plus 2–3 directions for the conflict state (notice, compare view, save/overwrite/merge/reload choices, what happens to the agent's version), desktop/390 px, light/dark, synthetic data, PICKER.md tablet, published with a Finnish summary, recommendation and questions. No production change.

## Acceptance Criteria

- [ ] Published prototype with directions and a recommendation.
