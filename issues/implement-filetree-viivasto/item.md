---
created: 2026-10-22
updated: 2026-10-22
type: feature
reporter: jari
status: done
priority: normal
preparation: ready
lane: editor-tree
lane_seq: 1
collision: [web/src/components/editor-files]
closed: 2026-10-22
---

# CodeMirror file tree: Viivasto with compact folder chains and the UI chevron

## Goal

Implement the CodeMirror file browser chosen in `proto-editor-settings-filetree` round 2: the **Viivasto** look (indent guides, monochrome icons, Auki / ● Muokattu / keyboard focus distinguishable, no coloured left edge) combined with **Tiivistetty**'s compact folder chains (single-child folder chains shown as one row, e.g. `src/components/editor`).

Jari 2026-10-22: the folder disclosure uses the same chevron (`>`, rotating when open) as elsewhere in the UI, not a triangle, and is clearly larger than in the prototype — find the existing chevron component/icon in `web/src/components/` and reuse it.

Prototype and research: `issues/proto-editor-settings-filetree/` (result.md, round-2/). Review link https://glasspad.example.test/p/oj2sbn7anwp77qcxhxpdgjluxy/. Keep the existing Settings › Editori segmented control as is.

## Acceptance Criteria

- [x] Production file tree matches the chosen direction on desktop and in the phone file picker, light and dark, with keyboard navigation and filtering of loaded names.
- [x] Storybook story updated; relevant Playwright/a11y specs pass.
