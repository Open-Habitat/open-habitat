---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-08
---

# Web addresses in messages open in the editor instead of the browser

## Description

Jari 8.11.2026: in an agent message about integration levels (Azure links such
as portal.azure.com, shell.azure.com, entra.microsoft.com) pressing a link
tried to open it in Habitat's own editor as if it were a workspace file
reference, instead of opening the web address in a new browser tab. Web
addresses, with or without a scheme, must be recognised as links and open in a
new tab; only real workspace paths open in the editor. Look at the file
reference detection (`web/src/app/fileRefs.ts`) and the Markdown renderer.
Add cases for bare domains, `https://` links and paths that look like
domains (`docs/asennus.md`, `notes.txt`).

## Acceptance Criteria

- [x] Reported Azure addresses open a browser tab from prose, inline code and Markdown links, not the editor.
- [x] Explicit HTTP(S) links and filename-like workspace paths retain their respective browser/editor destinations.
- [x] Component regressions and a host-backed browser popup test pass.
