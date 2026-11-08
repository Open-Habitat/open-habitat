# Result

Fixed shared QuickTooltip sizing and portal selection. OfferCard is an
`aside role="note"`, not a complementary landmark. Treating it as a landmark
put the tooltip in a narrow positioned containing block; auto width then
shrank it beside the corner icons. Intrinsic width keeps short labels on one
line, the existing max-width wraps long labels, and skipping non-landmark
asides lets React Aria position against the enclosing page landmark.
Explain-mode suppression and Escape/focus behavior are unchanged.

## Validation

On Birch, synthetic host-backed Chromium, OH_PORT_BASE=13600,
OH_BROWSER_WORKERS=2, private /var/tmp scratch and umask 077:

- `scripts/test-focused.sh --area web`: 194 files / 1459 tests passed,
  static and component checks passed.
- `--area browser --lab --spec lab-offer-tooltips.spec.ts`: 2 passed.
  At 1440 and 390, every available tab/download control in the types and
  folder fixtures is checked against measured text width, single-line height
  and viewport edges (PNG, SVG, Markdown, CSV, Python, ZIP, generic file,
  folder). The width-only intermediate fix failed the 390px right-edge
  assertion (524px); correcting portal selection made both cases pass.
- `--area browser --lab --spec lab-icon-tooltips.spec.ts`: 1 passed,
  including light/dark axe, keyboard description and Escape checks.
- `--area browser --lab --spec lab-explain-mode.spec.ts`: 4 passed.
- `--area browser --spec agent-file-offers.spec.ts`: 6 passed.

Each spec was run separately: repeated --spec flags select only the last one.
The first web check found formatting in the new spec; Biome fixed it and the
complete web check then passed. No daemon/contracts change or full gate.

Focused self-review checked shared selectors, bounded sizing, retained landmark
placement, unchanged Explain suppression and measurement assertions. Inspected
390px screenshot: short tooltip is horizontal and within the viewport.
Eight 2x screenshots and adjacent static HTML snapshots are under `evidence/`,
converted with `scripts/screenshots-to-avif.py`. These are synthetic lab
captures, not live-host or separate-UID evidence. Other file formats use the
same OfferActions/QuickTooltip but were not separately exercised.

## Decisions for later review

None: restores the agreed readable, viewport-bounded tooltips with existing
width limit and positioning machinery; no new controls or product behavior.
