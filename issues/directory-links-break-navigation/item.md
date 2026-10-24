---
created: 2026-10-24
updated: 2026-10-24
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: unlaned
---

# Directory links in conversations break the browser navigation

## Description

Jari 2026-10-24 on the test server (TARKASTETAVAA.md): file links in a conversation open the editor, but **directory links** do not open in the editor; they seem to leak into the whole browser navigation and break the whole app. Exact cause and extent unknown — user observation, not a confirmed diagnosis. Reproduce on the test lab first (a conversation message that links a directory, e.g. agent output naming `src/components/`), find the cause, and fix: a directory link must open the directory in the editor's file tree (or the agreed directory view) without leaving the SPA, and never break navigation.

## Acceptance Criteria

- [ ] Directory links open in the editor/file tree; browser history and the app stay intact; browser test covering a directory link and back-navigation.
