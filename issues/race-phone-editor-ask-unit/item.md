---
created: 2026-11-08
updated: 2026-11-10
type: bug
status: open
priority: normal
provenance: other
source_ref: taskfleet:01m6yavcna3rm33hh42pd7cgvr/test-failure:workspace-editor-phone-ask
originating_run: 01m6yavcna3rm33hh42pd7cgvr
originating_run_kind: spinoff
lane: phone-editor-ask
lane_seq: 1
preparation: ready
---

# Phone editor save-question unit test flakes under a loaded web run

## Description

## Observed

On Birch (8.11.2026, about 22:40), `./scripts/test-focused.sh --area web` on
branch `wt/h42pd7cgvr-r69-gatered` (main cd95f8108 plus the gate-red-r69
fixes, which do not touch the editor) failed one case:

`src/app/WorkspaceEditor.test.tsx > asks on Habitat's own row to save in VS Code before the phone editor, once per crossing`:
`Unable to find an element by: [data-testid="editor-phone-ask"]` (74 ms).

The same file passed 3/3 in isolation (`npx vitest run src/app/WorkspaceEditor.test.tsx`),
and the whole web area passed on the next run (1497/1497). It reads as a
synchronous `getBy` racing an asynchronous render while the full vitest run
loads the host. Eight parallel workers were running on Birch at the time.

## Impact

The clean gate runs the same web unit suite, so this can turn main's gate red
without any regression in the phone editor's save question.

## Direction

Wait for the question with `findByTestId` (or the state that renders it)
rather than a synchronous query, keeping the "once per crossing" assertion.
