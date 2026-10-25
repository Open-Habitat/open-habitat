---
created: 2026-10-21
updated: 2026-10-25
type: task
reporter: jari
status: done
priority: normal
lane: editor-choice
lane_seq: 1
related: ['@research-shell-editor', '@implement-workspace-editor']
collision: [docs/decisions]
preparation: ready
closed: 2026-10-21
closed_by: pi
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

## Acceptance Criteria

- [x] ADR 0028 records the delegated decision, daemon file contract, save guarantees and limits, browser-local preference, engine integration and rejected alternatives.
- [x] Independent critical review completed; confirmed Unicode and alias-lock findings resolved, with disposition in [review.md](review.md).
- [x] Implementation phases filed through intake as @implement-editor-files-codemirror and @implement-editor-monaco, untriaged and unlaned.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
