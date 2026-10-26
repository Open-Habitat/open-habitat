# Result

`lab-browser-editor`, `lab-title-generation` and `lab-integration-trash`
still run all their assertions, but they write snapshots into `issues/` only
with `OH_VISUAL_CAPTURE=1`. This is the same switch `lab-editor-settings` already
used. TESTING.md now states the rule for every evidence-writing spec.
`spinoffs` and `lab-worktree-agent` were already guarded by their own switches.

Verified on Birch at commit e8c71784:

- Focused lab runs of the three specs passed (12 cases) and left `git status` clean.
  With `OH_VISUAL_CAPTURE=1`, `lab-title-generation` rewrote its evidence again,
  so the opt-in still works (the rewrite was then restored).
- `test-focused.sh --area web` passed.
- Whole `npm run test:browser`: 388 passed, 5 failed, 3 skipped. None of the
  failures is in a touched spec. On rerun, four of them passed. In
  `browser-conversation` a different case timed out (load average 16–19 at
  the time). These were load flakes, so no issue was filed.
- `./scripts/ci-local.sh --clean --json` with `OH_PORT_BASE=17300` and private
  TMPDIR `/var/tmp/oh-gle.zi5VS2`: status passed, clean true. Receipt
  `/home/maintainer/src/open-habitat/.git/open-habitat-gate-receipts/ff4faebdf92d219c3b8aca2878cfd24f1527c7dd.json`
  (tree of e8c71784). This result file changes the tree, so the receipt covers
  the code commit, not the commit that adds this file.

## Decisions for later review

- I used the existing `OH_VISUAL_CAPTURE` switch rather than adding per-spec
  switches or writing to ignored output. A refresh is
  `OH_VISUAL_CAPTURE=1 ./scripts/test-focused.sh --area browser --lab --spec <spec>`.
- The default browser ports were taken on Birch by a concurrent run (4183 busy).
  All runs here used `OH_PORT_BASE=17300`.
