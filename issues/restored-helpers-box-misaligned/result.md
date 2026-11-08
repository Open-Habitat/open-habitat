# Result

The restore notice was already a direct child of `ConversationStream` in both
`BrowserConversation` and `HistoryView`. Its later-loaded `margin: … 0`
overrode the stream's shared `margin-inline: auto`, leaving the width-capped
box at the left. Using `margin-block` preserves the existing column centering
and width cap without another wrapper or duplicated dimensions.

## Validation

Tested the worker tree based on `git` parent recorded by this fix's commit:

- `./scripts/test-focused.sh --area web`: passed, 194 files / 1459 tests,
  plus static checks. First attempt caught formatting/non-null assertion lint
  in the new test; corrected before the passing rerun.
- `OH_PORT_BASE=13700 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec helper-archive.spec.ts`:
  passed. Existing archive/restore journey now compares the restored box's
  left edge and width against the neighbouring assistant feed row at 1440 and
  390, and checks it stays inside the viewport.
- Same named spec with `OH_RESTORE_ALIGNMENT_CAPTURE=1`: passed using the
  synthetic lab host. Screenshots at device scale factor 2 and adjacent static
  HTML are in `evidence/restored-{1440,390}.{avif,html}`. Converted with
  `scripts/screenshots-to-avif.py`; inspected both screenshots.
- Focused self-review: confirmed both mounts inherit the same column rule;
  vertical spacing, helper operations, labels and Explain targets are unchanged.
  No new controls or authority/state changes.

Evidence is host-backed synthetic browser evidence (fake Pi and stubbed helper
reads), not live-server or separate-UID qualification. No full gate was run.

## Decisions for later review

None: this restores the agreed layout, using the existing conversation column.
