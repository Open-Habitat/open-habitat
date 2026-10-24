---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: Observed by a worker's full gate run
source_ref: taskfleet:01m5pdaxhnzkt2588efze04vaj/observed:codemirror-getclientrects
originating_run: 01m5pdaxhnzkt2588efze04vaj
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-10-24
---

# CodeMirrorEditor.test leaves an unhandled jsdom getClientRects error that fails the gate's web checks

## Description

`./scripts/ci-local.sh --clean --json` stops in the `web-checks` phase: vitest reports an unhandled error from `web/src/components/CodeMirrorEditor.test.tsx` after its three tests pass:

```
TypeError: textRange(...).getClientRects is not a function
 ❯ clientRectsFor node_modules/@codemirror/view/dist/index.js:466:56
 ❯ DocView.measureTextSize … ❯ EditorView.measure … runAnimationFrameCallbacks (jsdom)
```

The last test before it was "refuses typing into an open conflict but not elsewhere, and keeps the person's lines on Sinun". It reproduced 3 out of 3 times on `main` (49a7faf3) with `npx vitest run src/components/CodeMirrorEditor.test.tsx` and 4 out of 5 times on a branch that does not touch the editor. A CodeMirror measure scheduled by requestAnimationFrame runs after the test, and jsdom's Range has no getClientRects. Because of this the gate cannot write a receipt.

Likely fix: stub `Range.prototype.getClientRects`/`getBoundingClientRect` in the test setup, or destroy the view and flush pending measures before teardown.

## Acceptance Criteria

- [x] CodeMirror merge tests destroy their views before draining controlled animation frames, without shared geometry stubs or product changes.
- [x] The focused file passes ten consecutive runs with no unhandled errors, and fast web checks pass.
