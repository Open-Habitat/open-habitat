# Result

Fixed the local `!` / `!!` command card in live output and saved native history.
The artifact was a glyph-based pseudo-element inheriting the global native
summary's CSS borders and rotation. The card now uses the same DisclosureButton,
SVG chevron and StatusMark as agent tool rows. Success says **Valmis**; nonzero
completion retains the exit code. OutputBox supplies the shared output modes,
copy controls and styling. Native block loading, exclusion metadata, stopping
and the person's collapsed/expanded choice remain intact.

## Verification

Base: `57d0706f898bf84d855828cc83c81e632f4d95fe`, plus this fix's implementation.
No Go, contracts or packaging inputs changed; no full gate was run.

- `./scripts/test-web-fast.sh`: final pass, **24.49 s**, 81 files / 472 tests,
  plus formatting, lint and TypeScript. Log: `/var/tmp/bash-card-final-fast-web.log`.
- `cd web && npx playwright test tests/command-cards.spec.ts`: **2 passed**,
  **7.3 s** browser time / **170.53 s** remote command wall time. Covers live to
  history handover, cancellation, keyboard disclosure, axe accessibility,
  exclusion, reload and 390px containment. Log: `/var/tmp/bash-card-browser.log`.
- Synthetic lab capture via temporary `lab-bash-card-polish.spec.ts`: **1 passed**,
  **2.5 s** browser time / **248.95 s** remote wall time. Screenshots and inert
  HTML twins: [desktop light](desktop-light.avif), [HTML](desktop-light.html),
  [phone dark](phone-dark.avif), [HTML](phone-dark.html). Visually inspected;
  these are capture evidence, not automated visual comparisons. The temporary
  capture spec was removed after collecting its outputs.
- Existing disclosure/inert-native-text regression retained using the new
  button interface. Added coverage that output view choice survives collapse
  and completion, and that nonzero completion is an error status. No UI wording
  assertions were added.
- Self-review of this localized presentation change; `git diff --check` and
  `python3 scripts/validate-project-view.py` passed.

## Failures and limits

The first fast run stopped on a new test's forbidden non-null assertion; it was
removed and the complete command passed on retry and again on the final tree.
Log: `/var/tmp/bash-card-fast-web.log`. Dependency discovery initially found no
local web installation; `npm ci --prefix web` supplied it successfully.
Exploratory lookups of a nonexistent conversation subdirectory and runner module
names were corrected by inspecting the actual files. No required check remains
failed or incomplete. Existing informational lint, build and jsdom canvas
warnings did not fail the checks.

Not deployed or verified on the live test server by this worker. After deployment,
try `!git status`, then a failing command: check the single chevron, Valmis vs.
nonzero status, output disclosure and copy/view controls.
