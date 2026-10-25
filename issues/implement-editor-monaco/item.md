---
created: 2026-10-21
updated: 2026-10-25
type: feature
status: done
priority: normal
provenance: other
provenance_detail: ADR 0028 implementation phase under Jari's delegated decision
source_ref: taskfleet:01m5fs673v3g8t13brvtj4erzt/implementation-phase:2
originating_run: 01m5fs673v3g8t13brvtj4erzt
originating_run_kind: technical-decision
related: ['@decide-editor-choice']
blocked_by: ['@implement-editor-files-codemirror']
lane: editor-choice
lane_seq: 3
collision: [web/editor]
preparation: ready
size: L
closed: 2026-10-21
---

# Add lazy desktop Monaco editor adapter

## Description

## Description

Implement phase 2 of ADR 0028 (`docs/decisions/adr-0028-selectable-workspace-editor.md`): the Monaco adapter and selectable desktop Monaco option, after the shared daemon API, Editori settings and CodeMirror default have landed in phase 1. Jari asked to try all three editors on 2026-10-21.

Monaco is a trusted bundled text-editing engine on the app origin, not code-server and not an extension host. Reuse the exact phase-1 API and save/conflict/uncertainty handling, preference key, one-document browser-editor shell, file picker, conversation FileRef/range entry point and editor header/full-window controls. Add no server file authority or settings store.

Dynamic-import Monaco only when selected and opened on desktop. Bundle its ESM workers locally with explicit worker entries and selected language features; no CDN, broad CSP relaxation, LSP process or workspace-supplied executable plugins. Syntax scope matches CodeMirror (plain text, Markdown, JS/TS/JSX/TSX, JSON, HTML, CSS, Go, Python, shell, YAML); use a small bundled tokenizer for a missing grammar and plain text otherwise. Theme from design tokens and dispose models/workers. Compact/phone viewports remain CodeMirror-only, including persisted Monaco preference and resize/dirty-buffer cases.

## Acceptance Criteria

- [x] Monaco can be selected on desktop and opens workspace files and conversation line ranges using the shared file API, never code-server start/handoff routes.
- [x] Shared adapter tests cover save/conflicts/uncertain replies, read-only or unsupported files, dirty transitions, identity reset, focus and full-window/header behavior with Monaco.
- [x] Host-backed browser tests verify phone/390px fallback without persisting a changed desktop preference and without fetching Monaco chunks/workers; dirty resizing never loses a buffer.
- [x] Production chunk/worker evidence records compressed initial/Monaco asset sizes, shows no Monaco fetch for CodeMirror use or closed settings, and all workers are self-hosted under the existing app CSP.
- [x] Both themes, Finnish keyboard controls, selection/ranges and accessible editor operation are checked; add Finnish test-server checklist to KOKEILTAVAA.md.
- [x] With both phases complete, move lasting authority constraints into nearest AGENTS.md and retire ADR 0028 per repository policy; do not remove it before phase 1 and 2 both land.

## Decisions

### 2026-10-21T18:00:53Z · @conductor

Accepted for execution 2026-10-21 under Jari's explicit delegation to proceed per ADR 0028's recommendations.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
