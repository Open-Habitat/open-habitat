---
created: 2026-10-22
updated: 2026-10-22
type: task
reporter: jari
status: done
priority: normal
lane: editor-choice
lane_seq: 1
related: ['@implement-editor-monaco']
collision: [web/editor]
preparation: ready
closed: 2026-10-22
---

# Drop Monaco; store the editor choice in the person's own configuration

## Description

Jari 2026-10-22 after trying the editors: Monaco can be dropped; keep CodeMirror 6 (default) and VS Code. He also asked why the editor choice is browser-local instead of an ordinary configuration. ADR 0028 chose browser-local storage to avoid a new host store; Jari prefers an ordinary configuration that follows the person across devices. Store the choice in the person's own home through the daemon (native, as their UID, e.g. an Open Habitat user settings file under the XDG config dir, or an existing per-user settings file if one exists), read on sign-in; no gateway or host-wide store. Remove the Monaco adapter, bundle, workers, tests and settings option entirely (pre-release, no compatibility). Update the AGENTS.md rules that ADR 0028 moved there. Keep the settings page functional; its visual redesign is proto-editor-settings-filetree.

## Acceptance Criteria

- [x] Remove the Monaco adapter, dependency, workers, option and dedicated tests; retain CodeMirror 6 default and VS Code.
- [x] Store the enum in the person's configuration through their daemon, read it across browser contexts, and keep gateway storage absent.
- [x] Update ADR-derived instructions; preserve identity, compact-layout and live-document guards with regression evidence.
- [x] Complete focused landing checks, independent review, result and Finnish test checklist without running the full gate or pushing.
