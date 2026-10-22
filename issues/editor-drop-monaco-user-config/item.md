---
created: 2026-10-22
updated: 2026-10-22
type: task
reporter: jari
status: open
priority: normal
lane: editor-choice
lane_seq: 1
related: ['@implement-editor-monaco']
collision: [web/editor]
preparation: ready
---

# Drop Monaco; store the editor choice in the person's own configuration

## Description

Jari 2026-10-22 after trying the editors: Monaco can be dropped; keep CodeMirror 6 (default) and VS Code. He also asked why the editor choice is browser-local instead of an ordinary configuration. ADR 0028 chose browser-local storage to avoid a new host store; Jari prefers an ordinary configuration that follows the person across devices. Store the choice in the person's own home through the daemon (native, as their UID, e.g. an Open Habitat user settings file under the XDG config dir, or an existing per-user settings file if one exists), read on sign-in; no gateway or host-wide store. Remove the Monaco adapter, bundle, workers, tests and settings option entirely (pre-release, no compatibility). Update the AGENTS.md rules that ADR 0028 moved there. Keep the settings page functional; its visual redesign is proto-editor-settings-filetree.
