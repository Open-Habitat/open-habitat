---
created: 2026-10-26
updated: 2026-10-26
type: bug
status: duplicate
priority: normal
provenance: other
source_ref: taskfleet:01m5vrvfw4560n02dsx2eewy4a/observed:lab-suite-writes-evidence
originating_run: 01m5vrvfw4560n02dsx2eewy4a
originating_run_kind: spinoff
closed: 2026-10-26
---

# Lab browser suite rewrites other issues' committed evidence

## Description

Running the ordinary lab browser suite (`npm run test:browser:lab --prefix web`) rewrites committed evidence of three other issues as a side effect:

- `web/tests/lab-browser-editor.spec.ts` overwrote the tracked `issues/editor-long-file-cannot-scroll/evidence/editor-*.{html,png}` (16 files modified),
- `web/tests/lab-title-generation.spec.ts` modified `issues/title-regenerate-arrow-spin/evidence/pending-*.html` and added untracked `pending-*.png`,
- `web/tests/lab-integration-trash.spec.ts` created untracked `issues/trash-view-misses-integration-files/{removal,trash}-*.{html,png}`.

Observed on 2026-10-26 in the `context-ring-indicator` worker on Birch after one lab-suite run; a `git add -A` staged them all and they had to be restored by hand before committing.

Impact: a worker that runs the lab suite and commits with `git add -A` lands rewritten evidence of unrelated issues (and a fresh render of a closed issue's evidence), and `taskfleet run merge` / the clean gate see a dirty tree. The evidence capture belongs to an explicit opt-in run, like `test:visual` (`OH_VISUAL_CAPTURE=1`), not the ordinary suite.

Direction: gate these screenshot/HTML writes behind the existing visual-capture switch (or write them under `web/test-results/`), so the ordinary suite leaves the tree clean.
