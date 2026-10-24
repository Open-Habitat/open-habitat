---
created: 2026-10-24
updated: 2026-10-24
type: task
reporter: jari
status: done
priority: normal
preparation: pending
lane: unlaned
closed: 2026-10-24
---

# Prototype: concurrent edit between the person and the agent

## Description

Jari 2026-10-24 tested concurrent editing: unsaved changes in the editor while the agent changes the same file, then trying compare and save. It felt odd. Prototype first, before changing production (CodeMirror editor, `implement-editor-files-codemirror` era behaviour). The central design question: does the person understand whose changes remain in force and what Compare and Save do? The observation alone does not show data loss or a technical defect.

Prototype round (method of earlier proto-* rounds, `design-system/process.md`): the current production behaviour as the baseline plus 2–3 directions for the conflict state (notice, compare view, save/overwrite/merge/reload choices, what happens to the agent's version), desktop/390 px, light/dark, synthetic data, PICKER.md tablet, published with a Finnish summary, recommendation and questions. No production change.

## Acceptance Criteria

- [ ] Published prototype with directions and a recommendation.

## Decisions

### 2026-10-24T05:25:15Z · @jari

Jari 2026-10-24 accepted the conductor's recommendation: 'Tuo heti' but the agent's changes are brought in only after a short typing pause (and at the latest on Save), never under the person's fingers; conflicts per line (Sinun / Agentin / Molemmat); undo with Ctrl+Z. When the person replaces the agent's version, the conversation shows a visible note with 'Kerro agentille' that drafts a message in the composer (nothing injected into Pi history). Neutral 'Tiedosto muuttui levyllä' unless the change came from an agent tool call. Three-way merge from a mature small library (e.g. node-diff3, license checked), not our own algorithm. Next: round 2 with these.

### 2026-10-24T05:52:05Z · @jari

Jari 2026-10-24 on round 2: 'Rivimerkit' with the two-second pause (round 2 recommendation) is the design to implement.
