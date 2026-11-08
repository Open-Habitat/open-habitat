# Result

Fixed the squeezed → stacked → side-by-side sequence. Settings rows now use
section-container width for stacking, including inline values and marked rows.
The settings navigation folds before the section becomes narrow, and the app
rail yields room before it can cause a second stack/unstack transition.

The direct settings route also had a stale `:has(> .s-page)` selector: the view
split now wraps the page, so the intended settings width never applied. The
720px conversation measure squeezed both settings columns even at 1600px.
The corrected descendant selector covers direct routes and the settings layer.

## Decisions for later review

- Fold the settings section navigation at 1400px rather than 1050px. Keeping
  1050px leaves too little room beside the 296px app rail and 210px settings
  navigation. This retains the existing list/detail navigation and search
  semantics rather than introducing another navigation design.
- While Settings is open, hide the app rail at 1100px rather than waiting for
  the ordinary 800px phone breakpoint. Closing Settings restores the unchanged
  navigation. Leaving it visible until 800px causes another narrow-content →
  wide-content jump; forcing rows to stay stacked despite newly available room
  would violate the requested container-driven layout.
- Use a 520px section threshold for ordinary rows instead of 400px. This gives
  descriptions and controls usable space before stacking, matching the existing
  recap timing threshold. Selector rows retain intrinsic wrapping above it.

## Verification

On Birch, based on `5d2819b66b4a05759a7cbee5128cce0fcf672df9` plus this commit's
changes; focused self-review (CSS, routing breakpoint synchronization, flex
basis on stacked selectors, both direct and layered routes). No daemon,
contract, native session state or authority changes.

- `./scripts/test-focused.sh --area web`: 188 files / 1408 tests passed,
  including typecheck and static checks.
- `./scripts/test-focused.sh --area browser --spec <spec>` separately for:
  `settings-width-sweep.spec.ts` (21), `settings-breakpoint.spec.ts` (2),
  `settings-search.spec.ts` (5), `settings-selectors.spec.ts` (2, including axe),
  `settings-close.spec.ts` (8), `server-settings-area.spec.ts` (3): all passed.
- New geometry sweep visits all 21 settings routes from 1600 to 390px, in 20px
  steps plus both sides of shell boundaries and every pixel from 1065 to 1035.
  It rejects a row value returning beside its label after stacking and checks
  section overflow. The regression failed during development before the stale
  width selector was corrected. It exercises rendered fixture rows, not every
  optional editor or connected-service state.
- Browser runs used `umask 077`, private `/var/tmp/oh-setbp.*` scratch,
  `OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=15300`.
- Capture: `OH_VISUAL_CAPTURE=1 ./scripts/test-focused.sh --area browser --spec
  settings-width-sweep.spec.ts --tag 'tili:'` passed. Six 2x screenshot/static
  HTML pairs in `evidence/fixed-{1060,1050,1040}-{light,dark}.*`; inspected light
  and dark at 1050. These use synthetic lab identities, not the live host.
- `git diff --check`, issue metadata and project-view validation run before
  commit. No whole browser suite or clean gate; integrated validation belongs
  to the conductor. No live installation claim.

## Development failures resolved

The first sweep could not import JSON under Node ESM; adding the import type
attribute fixed test discovery. Initial sweep runs then caught the still-
constrained direct route and passed after fixing its selector. A combined
command with repeated `--spec` ran only the last named spec; each was rerun
separately. The close test's old 1280px 'desktop' scenario had become folded;
its wide-layout scenario now uses 1600px and all eight cases pass. Initial
source searches named non-existent files; subsequent scoped searches found
the actual components. No failed checks were treated as passing.
