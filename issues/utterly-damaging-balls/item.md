---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: worker test run
source_ref: taskfleet:01m5pe2kb30cvfwmdhccd3k9pd/test-run:codemirror-getclientrects
originating_run: 01m5pe2kb30cvfwmdhccd3k9pd
originating_run_kind: spinoff
---

# Web unit suite: CodeMirrorEditor.test leaves an unhandled getClientRects error in jsdom

## Description

Whole-suite `npm run test` in `web/` (vitest, jsdom) on main at bf968d65 reports
`Tests 615 passed` but `Errors 1 error`:

    TypeError: textRange(...).getClientRects is not a function
     ❯ clientRectsFor node_modules/@codemirror/view/dist/index.js:466:56
     ❯ DocView.measureTextSize ... ViewState.measure ... EditorView.measure
     ❯ runAnimationFrameCallbacks node_modules/jsdom/...
    This error originated in "src/components/CodeMirrorEditor.test.tsx" ...
    last test: "refuses typing into an open conflict but not elsewhere, and keeps the person's lines on Sinun"

Running the file alone passes cleanly; in the full suite it fails reproducibly
(two runs on the branch, one on a clean main checkout). CodeMirror's measure
runs from a requestAnimationFrame after the test, and jsdom's Range lacks
`getClientRects`. Vitest counts an unhandled error as a failed run, so
`scripts/test-focused.sh --area web` (and presumably the gate's web phase)
exits non-zero although every test passed. Likely fix: destroy the EditorView
in cleanup, or stub `Range.prototype.getClientRects`/`getBoundingClientRect`
in the test setup.

Found by the `editor-replace-note-sticky` worker.
