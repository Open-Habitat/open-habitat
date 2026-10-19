---
created: 2026-10-19
updated: 2026-10-19
type: task
reporter: jari
status: open
priority: normal
related: ['@proto-file-viewing']
lane: unlaned
collision: [issues/proto-file-viewing-2]
preparation: ready
---

# Prototype round 2: room for the workspace editor (Editori)

Second round after `proto-file-viewing` ("Jari's response"): Jari prefers direction 2 **Editori** (the workspace's VS Code / code-server, links open a tab at the line), but in the first round the editor had too little room. Rethink the space: e.g. the editor as the main view with the conversation as a narrow, collapsible side column or a drawer; a resizable split that remembers its width; the editor full-window with the conversation one keystroke away; and how file links in the conversation open the editor without losing the reading place. Desktop widths 1280–2560, laptop 1366, phone (where the editor is not usable: what happens instead), light and dark. Feasibility of code-server, its own origin and `path:line` opening per `research-shell-editor`.
