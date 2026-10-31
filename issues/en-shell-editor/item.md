---
created: 2026-10-31
updated: 2026-10-31
type: task
reporter: jari
status: open
priority: high
lane: en-shell-editor
lane_seq: 1
preparation: ready
---

# English: context page, editor and the remaining shell

## Description

Part of `ui-english-coverage` (Jari 31.10.: a customer needs English soon).
`ui-language-choice` landed the catalog mechanism; `web/AGENTS.md` states the
convention (one catalog file per module in `web/src/text/`, `useText` /
`liveText`, `plural`/`formatDate`, identifiers untranslated).

This unit owns these modules and their stories and tests:

`components/ContextPage.tsx` (+ fixtures), `app/App.tsx`, `app/BrowserShell.tsx`, `app/BrowserDocument.tsx`, `app/WorkspaceEditor.tsx`, `components/EditorSplit.tsx`, `components/EditorReplaceNote.tsx`, `components/EditorFileTree.tsx`, `app/settingsIndex.ts` (if any Finnish remains), `app/documentFixtures.ts`, and every other file under `web/src` with user-visible Finnish that no sibling unit (en-conversation, en-composer, en-workspaces, en-workers) lists.

Move every user-visible Finnish string in them into their own catalog files
and translate it. Messages that arrive from the daemon or gateway as Finnish
text are not this unit's; list any you meet in `result.md`.

## Acceptance Criteria

- [ ] With English chosen, no Finnish text in these views; catalogs complete
      (`src/i18n/catalogs.test.ts` passes).
- [ ] Their stories render in both languages; touched specs pass in Finnish.
- [ ] English screenshots of the views at device scale factor 2 in the issue
      directory.

## Comments
