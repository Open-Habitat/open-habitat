# Result

The folded Settings page now centres the existing 400 px column as a whole,
including search, section content, back and close controls. At phone widths it
fills the available space with equal margins. Desktop layout is unchanged.
No new control, copy, flag, state or authority was introduced.

## Decisions for later review

- Retain the agreed 400 px cap and centre the shared page rather than widening
  rows or centring each child separately: this preserves the previous row
  wrapping and keeps the close control aligned with both list and detail.

## Evidence and validation

Tested base `fb1c9c0dbff9c15eb8b836eeb550e42b0380f9da` with this commit's
Settings.css and settings-breakpoint.spec.ts changes, on Birch.

- `./scripts/test-focused.sh --area web`: passed after replacing the new test's
  non-null assertions with explicit missing-element errors.
- `OH_PORT_BASE=12500 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec NAME`
  passed for every settings spec, individually: account-settings (17),
  lab-editor-settings (4), recap-settings (4), server-settings-area (3),
  settings-breakpoint (2), settings-close (8), settings-experimental (3),
  settings-model-picker (5), settings-name-and-storage (2), settings-search (5),
  settings-selectors (2), settings-three-pages (10), settings-width-sweep (21).
  Total: 86 browser cases. The width sweep covers all 21 settings sections.
- Extended the existing breakpoint journey with equal-margin geometry checks
  for list, search and detail and left-edge alignment of the back row; added
  600 px alongside 390 and 800 px, with both rail states.
- `OH_NARROW_SETTINGS_CAPTURE=1` on the breakpoint spec captures list and detail
  at 390/600/800, light/dark, DPR 2. Twelve AVIF/HTML pairs are in `evidence/`,
  converted with `scripts/screenshots-to-avif.py`. These are synthetic lab
  captures, not live-host or separate-UID evidence.
- Focused self-review: checked CSS specificity including wide settings pages,
  unchanged desktop rules, close-control alignment, and representative light
  list/dark detail images. Existing close, search, accessibility and width-sweep
  journeys passed. No daemon, contract or session-state path changed.

## Execution corrections

An initial combined repeated `--spec` invocation ran only the final width-sweep
spec (the wrapper accepts one spec); all remaining specs were then run by name
in separate invocations. Initial source searches used two nonexistent guessed
paths; inspection continued with actual files. Neither affects final coverage.
No full gate or whole browser suite was run; deployment/live verification is
left to the conductor.
