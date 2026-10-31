---
created: 2026-10-31
updated: 2026-10-31
type: task
reporter: jari
status: open
priority: high
lane: en-workers
lane_seq: 1
preparation: ready
---

# English: workers, processes and terminals

## Description

Part of `ui-english-coverage` (Jari 31.10.: a customer needs English soon).
`ui-language-choice` landed the catalog mechanism; `web/AGENTS.md` states the
convention (one catalog file per module in `web/src/text/`, `useText` /
`liveText`, `plural`/`formatDate`, identifiers untranslated).

This unit owns these modules and their stories and tests:

`components/BackgroundStrip.tsx`, `components/Spinoffs.tsx`, `app/spinoffs.ts`, `components/ProcessTray.tsx`, `app/processes.ts`, `app/workerRequests.ts`, `app/workSentence.ts`, `app/WorkerTerminal.tsx`, `components/TerminalPanel.tsx`, `app/terminals.ts`, `components/Operations.tsx`, `components/RestartNotice.tsx`, `components/NextWaitingQueue.tsx`, `components/NextWaitingRow.tsx`.

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
