---
created: 2026-10-21
updated: 2026-10-25
type: feature
reporter: jari
status: done
priority: normal
lane: editor-header
lane_seq: 1
related: ['@proto-editor-buttons']
collision: [web/conversation-header]
preparation: ready
size: M
closed: 2026-10-21
---

# Editor controls in the editor's own header, icon-only

## Description

Implement Jari's choice from proto-editor-buttons round 2 (direction 2, "Oma otsake"; see issues/proto-editor-buttons/result.md and design-system/prototypes/rounds/2026-10-21-editorin-painikkeet-2/).

The conversation header stays in the right-hand conversation as in production. Opening the editor is its editor icon; full-window and close live in the editor's own top-right corner and stay visible in full-window mode. Editor controls are icon-only using the existing production icons (`editor`, `forward`, `back`), with accessible names and tooltips. Return from full window both from the control and from the conversation strip. 390 px: panes stack, conversation and composer remain reachable.

Done: production components (Navigation.tsx AgentHeader, WorkspaceEditor / EditorHeaderControls, EditorSplit) with stories, tests per TESTING.md; KOKEILTAVAA.md entry.


## Acceptance Criteria

- [x] Conversation header keeps the editor opener; size and close live in the editor-local header and remain reachable in full-window mode.
- [x] Both return routes preserve the conversation draft; closing from full-window restores the conversation and reopening keeps the editor frame.
- [x] At 390 px panes stack and the composer remains reachable; named icon controls work by keyboard in both themes.
- [x] Production components have Storybook examples, focused checks and a Finnish test-server checklist entry.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
