---
created: 2026-10-19
updated: 2026-10-19
type: task
reporter: jari
status: open
priority: normal
related: ['@research-shell-editor']
lane: unlaned
collision: [issues/proto-file-viewing]
preparation: ready
---

# Prototype: opening the workspace's files and clickable file links in messages

Jari, 2026-10-19: next prototype file viewing/editing. "Tässä varmaan koko repon avaaminen, mutta meillä pitäisi kanssa tunnistaa viesteistä tiedostolinkkejä ja niistä klikattavia."

Prototype round covering: (1) opening the whole repository/workspace for browsing and editing (an embedded web VS Code such as openvscode-server/code-server vs a lighter built-in file view, as directions; feasibility from `research-shell-editor`), and (2) recognising file references in conversation messages and tool output (`path/to/file.go:42`, `@file`, absolute workspace paths, diffs) and making them clickable: what opens (a side panel with the file at that line, the editor, a diff), on desktop and phone, light and dark. Recognition must be honest: only paths that exist in the workspace become links.
