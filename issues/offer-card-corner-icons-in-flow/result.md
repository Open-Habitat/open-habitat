# Result

Fixed the positioning specificity in both the default and touch rules. The
corner row now floats on hover-capable screens without consuming title width;
the touch rule still puts it on its own final row. Tooltip styles are unchanged.
No controls or copy were added.

## Evidence and review

Focused self-review: checked the competing selectors, pointer hit layer,
hover/focus visibility, touch override and unchanged tooltip rules.
Tested on base `2531959de` plus this change, on Birch with private disk-backed
TMPDIR, umask 077, OH_PORT_BASE=14400 and OH_BROWSER_WORKERS=2:

- `./scripts/test-focused.sh --area web`: passed, 194 files / 1463 tests.
- `./scripts/test-focused.sh --area browser --spec agent-file-offers.spec.ts`:
  passed, 6 cases including assets-list and phone journeys.
- `./scripts/test-focused.sh --area browser --spec lab-offer-tooltips.spec.ts`:
  passed, 2 cases, 390 and 1440 viewport widths.
- `./scripts/test-focused.sh --area browser --spec lab-offer-layout.spec.ts`:
  passed, 2 cases measuring 340px and 240px cards on hover and touch devices.
  Removing the actions must not increase the title column width; hovering and
  focusing must not shrink it. Touch actions remain visible below the body.
- Negative control: temporarily restoring the old default selector fails the
  width assertion with 77px of stolen space. Restoring the fix passes again.

`evidence/` contains paired static HTML and 2x AVIF card captures from the
synthetic lab; PNGs converted with `scripts/screenshots-to-avif.py`. Inspected
pointer-340 and touch-240 screenshots. These are synthetic same-UID browser
checks, not live-host or Unix-isolation evidence. No full gate was run.

Initial check attempts found test-only lint/format errors (fixed), focus on
an action wrapper rather than the card's button (changed to the button), and
whole-page snapshot capture encountering an unavailable unrelated SVG thumbnail
(changed to the tested card's region). Repeated --spec arguments selected only
the last spec, so the lab specs were rerun separately. All final checks passed.

## Decisions for later review

The current production assets list uses compact `ah-asset-row` rows, not
OfferCard. Rather than replacing its design or claiming to measure an absent
card there, the new browser check constrains the real conversation OfferCard
to the issue's 340px and 240px list-sized widths. The existing assets-list
journey is also checked. This tests the reported shared-card defect directly;
no product decision or redesign was needed.
