# Result

Fixed on the present light and dark colours; main has no high-contrast theme,
so its 4.5:1 rule and the contrast-theme rules in the proposal belong to
`brand-themes-and-state-mark`, which builds on the tokens added here.

- `.button` draws its variant's `--i-border` (`Controls.module.css`);
  secondary uses `--ah-control-line`, danger-subtle `--ah-err-line`.
- Tokens at 3:1 on the hardest background (`--ah-rail` light, `--ah-current`
  dark, and a tone line also on its own soft fill): `--ah-control-line`,
  `--ah-line-strong`, `--ah-current-line`, `--ah-accent-line`,
  `--ah-err-line`; new `--ah-ok-line`, `--ah-turn-line` and
  `--ah-disabled-line` (= `--ah-line`, used by the shared disabled state).
- Fields, segmented frame and selected segment, banners (success in its own
  tone), notices (warning in the turn tone), toast (now bordered), capacity
  chip, rail search, current home/nav/agent link, settings selected page.
- Disabled checkbox and radio: grey box on the disabled fill, label in the
  disabled colour. Route and section headings (`h1`–`h3` with tabindex −1)
  show no ring on programmatic focus.
- No Päivä/Yö exception was needed: fields and the segmented control meet 3:1.

## Measurement

`web/lab/measure-boundaries.mjs` reports the better of fill and drawn edge
against the opaque background behind each component, per state and theme,
from a Storybook build (the command is in its header). Weakest instance per
component; 44 combinations below 3:1 before, 0 after. Disabled rows are
informational: a disabled button is now quieter than every enabled one
(before it was the only bordered button).

| Component | Light before → after | Dark before → after |
|---|---|---|
| button secondary | 1.13 → 3.17 | 1.28 → 3.73 |
| button secondary hover | 1.22 → 3.17 | 1.46 → 3.73 |
| button danger-subtle | 1.03 → 3.18 | 1.08 → 3.70 |
| button danger-subtle hover | 1.14 → 3.18 | 1.19 → 3.70 |
| button primary | 4.33 → 4.33 | 6.38 → 6.38 |
| button danger | 5.85 → 5.85 | 8.42 → 8.42 |
| segmented frame | 1.17 → 3.17 | 1.35 → 3.73 |
| segment selected | 1.15 → 3.11 | 1.35 → 3.73 |
| field | 1.17 → 3.17 | 1.35 → 3.73 |
| field invalid | 5.85 → 5.85 | 8.42 → 8.42 |
| textarea | 1.17 → 3.17 | 1.35 → 3.73 |
| checkbox | 6.77 → 6.77 | 11.08 → 11.08 |
| radio | 6.77 → 6.77 | 11.08 → 11.08 |
| current home link | 1.07 → 3.17 | 1.21 → 3.73 |
| button disabled | 1.45 → 1.17 | 1.76 → 1.35 |
| checkbox disabled | 6.77 → 5.32 | 11.08 → 6.79 |
| banner danger | 1.27 → 3.18 | 1.47 → 3.70 |
| banner neutral | 1.17 → 3.17 | 1.35 → 3.73 |
| banner progress | 1.17 → 3.17 | 1.35 → 3.73 |
| banner success | 1.24 → 3.18 | 1.89 → 3.72 |
| banner page | 1.27 → 3.18 | 1.47 → 3.70 |
| capacity chip | 1.14 → 3.08 | 1.25 → 3.45 |
| toast | 1.07 → 3.17 | 1.09 → 3.73 |
| notice info | 1.24 → 3.30 | 1.89 → 4.01 |
| notice warning | 1.17 → 3.18 | 1.35 → 3.70 |
| notice danger | 1.27 → 3.18 | 1.47 → 3.70 |
| rail search | 1.13 → 3.06 | 1.31 → 3.62 |
| current nav link | 1.11 → 3.06 | 1.18 → 3.62 |
| settings page selected | 1.30 → 3.17 | 1.61 → 3.73 |

`src/test/boundaryContrast.test.ts` holds the token rule in the unit suite.

## Validation

- `scripts/test-focused.sh --area web`: 212 files, 1625 tests passed.
- Browser (`OH_BROWSER_WORKERS=2`): design-system, control-states,
  account-settings and shell-accessibility specs, 31 passed, 2 skipped
  (axe light/dark included).
- Before/after captures, 1440 and 390, light and dark, scale 2, kept outside
  the repository with the worker results.

Not measured: the composer frame on its own (it uses `--ah-line-strong`,
raised by the token), hover and press from real pointer use (forced states of
the interaction matrix), and the remaining ~40 `--ah-line-strong` borders one
by one.

Live check: not done; this worker does not deploy. On a host after deploy,
the secondary and danger-subtle buttons, fields and banners show a visible
edge in both themes, and changing settings pages shows no ring on the heading.
