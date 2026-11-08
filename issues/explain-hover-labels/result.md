# Result

Explain mode now suppresses QuickTooltip (including the rail's right-opening
labels), CSS-only activity/dictation help, and native title bubbles across the
page, including newly mounted panels. Existing tooltips close when the mode
starts. Ending the mode restores ordinary help and the latest native titles.
Accessible labels and normal hover-revealed controls remain available.

## Validation

Tested this issue's final runnable changes on Birch, based on 8ddcb319f.

- `./scripts/test-focused.sh --area web`: 194 files / 1450 tests passed,
  including native-title insertion, update, removal, restoration and name tests.
- `OH_PORT_BASE=13200 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec lab-explain-mode.spec.ts --lab`: 4 passed, including existing desktop and phone interactions and the new hover/focus suppression/restoration regression. The regression advances browser timers past tooltip delay.
- Same browser command with `--spec lab-icon-tooltips.spec.ts`: 1 passed,
  including light/dark axe checks and ordinary hover/focus help.
- `git diff --check`, issuectl doctor and project-view validation passed.
- Focused self-review: checked all tooltip/title occurrences in components,
  preserved the existing single Explain state owner in an import-cycle-free
  module, checked portal coverage and cleanup, and added title-clearing and
  associated-label coverage after review.

Browser evidence is host-backed synthetic lab evidence, not live-server or
separate-UID evidence. `explain-hover.png` and `explain-hover.html` are the
paired synthetic capture (2x): the rail button shows its Explain card without
its ordinary right-opening label. No Go, contract, full suite or clean gate run.

Initial web checks rejected an undocumented !important and later test non-null
assertions; both were corrected and the complete focused web check rerun green.
The focused wrapper accepts one --spec: an initial two-spec invocation ran only
the last; both specs were subsequently run separately and passed.

## Decisions for later review

Suppress native titles throughout the host page, including filename/path help,
rather than maintaining a list of control labels: this follows the requested
no-tooltip behavior and covers dynamically opened panels. Titles return on exit.
Embedded pages' own DOM is outside the host page's Explain mode; their frame
name is preserved. No new product behavior or authority boundary was introduced.
