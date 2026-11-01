# Result

Settings' section list folds at window widths ≤1050 px, regardless of the
app rail state. Back navigation, close placement and search previews follow
that same boundary. Phone row layout, controls and spacing are unchanged.

## Decisions for later review

- Use exactly 1050 px (inclusive), rather than the prototype's 1140 px or a
  container query: this implements Jari's chosen window-width model.
- Move only list/detail visibility, navigation positioning and the close
  button's folded placement. Keep the other 760 px rules (rows, marked rows,
  version alignment, model sheet, recap columns and search touch sizes), and
  both 800 px rules (inline editor sizing and layer padding). Raising them all
  would turn a wide single section into phone controls without needing to;
  existing content-width queries still protect narrow columns.
- Keep the close button with the back row in folded desktop windows rather
  than retaining a sticky third column: the page is now vertical and a third
  flex child would otherwise move below its content.

## Verification

Tested the final production changes on base e78207bd (this commit's diff),
Birch, synthetic identities only, umask 077, disk-backed TMPDIR,
OH_PORT_BASE=10310 and OH_BROWSER_WORKERS=2.

- `./scripts/test-focused.sh --area web`: static/type checks and 1194 tests pass.
- `./scripts/test-focused.sh --area browser --spec settings-breakpoint.spec.ts`:
  2 pass; both rail states resize across 1050/1051, 1040/1060/1280, 810 and
  390 px; section/back/list visibility, close reachability and content overflow.
- Same browser command separately for `settings-search.spec.ts`: 5 pass,
  including no automatic preview hiding results at 1040 px and phone navigation.
- Same command for `settings-close.spec.ts`: 8 pass, including axe checks and
  every settings section scrolled through at 1040 px without close overlap.
- Initial browser invocation repeated `--spec`; only the last was selected.
  Output inspection caught this; the other two were rerun separately above.
- Synthetic lab captures at device scale factor 2: `evidence/{1040,1060,1280}-{open,closed}.{png,html}`.
  Reproduce with `web/lab/settings-breakpoint-1050.mjs` while the lab runs.
  Inspected the 1040/1060 open-rail images: expanded section below the boundary,
  readable account content beside the list above it. Captures are review
  material, not automated visual comparison evidence.

`issuectl doctor --json`, project-view validation and `git diff --check` also
completed; doctor retains the repository's non-AVIF evidence advisories.

Focused self-review checked each media query's responsibility, CSS/script
agreement, resize behavior and interaction with the newly landed selectors.
No host, contract, authority or session-state changes. Full gate and whole
browser suite deliberately not run; this is host-backed synthetic UI evidence,
not installed-host or UID-isolation acceptance.
