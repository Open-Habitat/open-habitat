# Result

The path was explicitly included in T01's name selector. It now has its own
stable `workspace-path` target and passive T46 card in Finnish and English.
T01 only targets the name. No action or authority changed.

Reviewed the remaining header mappings: copy, GitHub, rename, archive, delete,
new worktree and new conversation retain their distinct cards; the icon picker
and icon-source note already have separate T24 and T39 targets.

## Verification

On the worker tree based on `b688d27ffafad8bebfe47c1f30f1ac2e3d189522`,
with the diff recorded by this result's commit:

- `./scripts/test-web-fast.sh`: passed, including catalog and Finnish checks.
- `./scripts/test-focused.sh --area browser --spec lab-explain-mode.spec.ts --spec lab-explain-coverage.spec.ts`: 20 passed.
- The new regression exercises name, path and seven action cards at 1440 and
  390 CSS pixels in Finnish and US English, using hover and touch respectively.
  Existing cases exercise safe navigation and blocking lasting actions.
- `python3 scripts/generate-ui-reference.py` and `--check`: passed after
  generation. Kept only the two relevant generated references; generation also
  exposed pre-existing drift in `text--worktrees.tsx.md`, deliberately excluded.
- `git diff --check`: passed.

Synthetic-lab screenshot/static-HTML pairs are adjacent: `{fi-FI,en-US}-{1440,390}-{T01,T46}`.
Visually inspected the folder card in all four language/width combinations:
correct path highlighted, complete readable card, no clipping. UK uses the same
new English text without an override. Name cards are also captured and the
regression verifies their independent identity. No live-host or UID-isolation
claim; no Go implementation changed and the full gate was not run.

Focused self-review was proportionate: a stable selector, passive bilingual
copy and regression coverage, without state, contract or authority changes.
