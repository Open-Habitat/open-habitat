---
created: 2026-11-15
updated: 2026-11-15
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-15/editor-symlinks
lane: unlaned
lane_seq: 1
collision: [internal/daemon/editor_files_linux.go]
preparation: ready
closed: 2026-11-15
---

# Editor file list does not handle symbolic links

## Description

Jari 15.11.2026: the editor mode's file list should handle symbolic links properly.

Today the editor's file access (`internal/daemon/editor_files_linux.go`) opens every path with `openat2` and `RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_XDEV`, so a symlink in the workspace cannot be followed (and how it shows in the list is to be checked).

Expected: a symlink is visible in the list for what it is, a link to a file or folder inside the workspace opens and browses like its target, and a link that points outside the workspace (or is broken) is shown honestly, with what can and cannot be done.

## Acceptance Criteria

- [x] Relative in-workspace file/folder links show their target and open/browse; saves preserve the link.
- [x] Escaping, broken and looping links remain visible but unavailable with a reason; protected paths stay protected.
- [x] Mid-save link substitutions cannot redirect writes; daemon, contract, web and browser checks pass after independent review.

Findings, decisions and verification are recorded in [result.md](result.md).
