# Result

The new-conversation picker keeps the provider segments, ranked current models,
older-model disclosure and thinking levels, without the explanatory paragraphs,
technical ids or observation badges. The footer links directly to agent settings.
Recent refusals still disable selection with a short reason; capability checks
are unchanged. The composer chip also uses the existing display-name helper.

Outside pointer clicks dismiss without applying a choice; Escape and explicit
commit restore trigger focus. A composer button reset was overriding the standard
primary button: it now excludes controls that already use the button primitive.
No app-shell header, shared state, contract or daemon changes.

Reclassified as a bug for the requested `fixed` closure: the reported scrolling,
failed dismissal and invisible button surface are defects.

## Validation

Implementation based on `da3ccf6a424add793a991e27c79d0f9314f2ac2a`; the fix commit
carries the tested source. Commands use disk-backed `TMPDIR=/var/tmp`; browser
suites run serially through the installed remote command dispatcher.

- `npm ci --prefix web`: passed.
- `./scripts/test-focused.sh --area web`: passed (537 tests, format/lint/typecheck).
- `npm run build-storybook --prefix web`: passed; compact, refusal and interactive
  composer stories import production components.
- `./scripts/test-focused.sh --area browser --spec lab-picker-declutter.spec.ts`:
  passed; four viewport/theme combinations, axe, no scrolling/clipping,
  primary surface before hover, outside/Escape dismissal, explicit local commit,
  older disclosure and settings navigation.
- `./scripts/test-focused.sh --area browser --spec settings-model-picker.spec.ts`:
  3 passed (provider browsing, optimistic default/refusal, unavailable provider).
- `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts --tag @model-controls`:
  3 passed (local choice, draft preservation, native default independence).

Initial lint rejected a test non-null assertion. Initial browser checks clicked
an input covered by the phone sheet, then expected a formatted chip name before
its display helper was wired. These were corrected and rerun. No required check
was omitted. No Go/contracts/full-gate or live-provider claim is made.

## Visual review

Reviewed all four synthetic-lab captures against the existing composer direction
(`design-system/prototypes/rounds/2026-10-19-koko-alakerta/round.js` and `round.css`)
and this issue's explicit simplification. That prototype specifies the compact
composer trigger and bottom-anchored chooser location, not the chooser's detailed
contents. Retained the existing token surfaces, accent selection, border/radius,
shadow and horizontal low-to-high thinking scale. The ordinary picker fits at
1366×768 and 390×768 with no scrolling; expanded old catalogs and exceptional
error messages retain bounded overflow rather than clipping.

Each screenshot has an adjacent offline HTML snapshot. These are review material,
not automated visual comparisons. Header layout in the captures is intentionally
unchanged and belongs to the other worker.

- [Desktop light](attachments/picker-1366-light.avif) · [dark](attachments/picker-1366-dark.avif)
- [390 px light](attachments/picker-390-light.avif) · [dark](attachments/picker-390-dark.avif)
