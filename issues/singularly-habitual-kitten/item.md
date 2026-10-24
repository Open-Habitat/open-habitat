---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m5pcndra4xva0rrv9ffww7vj/gate:caa48b08-lab-browser-editor
originating_run: 01m5pcndra4xva0rrv9ffww7vj
originating_run_kind: spinoff
---

# lab-browser-editor 390 cases flake in the gate: ambiguous main.go locator

## Description

## Description

`tests/lab-browser-editor.spec.ts:9` ("editor evidence 390 light/dark") failed in the full clean gate on 2026-10-24 (tree of commit caa48b08, run 01m5pcndra4xva0rrv9ffww7vj) with a Playwright strict-mode violation:

    getByTestId('editor-file-entry').filter({ hasText: 'main.go' }) resolved to 2 elements:
      cmd/main.go (aria-level 2) and main.go (aria-level 1)

The spec expands `cmd` and then clicks "the" `main.go` by text, which also matches the workspace root's `main.go`. It passes when run alone (4/4 twice) and on the next full gate on the same tree, so whether both rows are matched depends on timing under load. The same spec was already seen flaking in the gate before this run.

Impact: the clean gate goes red at random, which costs a rerun (~6 min) and makes a red gate less trustworthy as a health signal.

Likely fix: select the intended row by its `data-path` (e.g. `cmd/main.go`) instead of by text.
