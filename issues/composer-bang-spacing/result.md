# Result

Implemented and rebased over the folder-sharing removal without changing that
feature. Runnable changes were verified at `5662414c994fc1b1098b1d81d7480571f1f19582`;
subsequent edits only record evidence, completion and the Finnish try-out entry.

## Choice

Keep the ordinary native textarea and its exact value. A 24 KB OFL derivative
of the already bundled JetBrains Mono adds a space-width advance after an
initial `!` / `!!` through contextual positioning. It changes no characters
and introduces no ligatures. This avoids a second editable DOM, offset
translation, clipboard filtering, synthetic whitespace and composition/undo
bookkeeping. The deterministic generator and original license stay beside the
font. If the font fails to load, only the visual gap is lost; text remains safe.

The composer has its own blue focus token in each theme. Its border and outer
ring use the same token, including shell mode. Contrast against the editor
surface is **5.41:1 light**, **8.52:1 dark**. Other controls retain their existing
focus tokens.

## Verification

All final checks passed after the rebase:

- `./scripts/test-web-fast.sh`: 84 files, 475 tests; formatting, lint, types.
- `./scripts/test-focused.sh --area browser --spec composer-geometry.spec.ts`:
  4 cases, desktop/390 px × light/dark. Checks visible advance independently
  from the textarea value, no spacing on a later bang, clipboard copy/paste,
  selection replacement, backspace across the prefix, native undo, Chromium
  IME composition/commit, no composing-Enter submission, and ≥3:1 border contrast.
- `./scripts/test-focused.sh --area browser --spec command-cards.spec.ts`:
  2 cases; native command execution, stopping and excluded-context output.
- `./scripts/test-focused.sh --area browser --spec lab-composer-focus.spec.ts`:
  2 cases; the focus ring remains painted on all four sides.
- `./scripts/test-focused.sh --area browser --spec lab-composer-bang-spacing.spec.ts`:
  4 capture cases, both prefixes per case. Capture only, not visual regression
  assertions. Browser execution used Fleetrepo's remote warm runner.
- `npm run storybook:test --prefix web`: built successfully. The new
  `BangSpacingAndFocus` story uses the production composer at desktop/390 px,
  with both themes and prefixes; click any field to inspect focus.
- Font regenerated twice with identical SHA-256
  `bca4a37cb8264fdf468d45fb432cc0a008213661c60edd1092bbc6cf67414049`.
- Focused self-review: checked unchanged input/send paths, font licensing and
  reproducibility, literal code typography, theme contrast, and folder-removal
  integration. No residual finding worth filing.

Synthetic-lab evidence, each AVIF beside its self-contained static HTML:

- [Desktop light](evidence/single-1440-light.avif) · [HTML](evidence/single-1440-light.html)
- [Desktop dark](evidence/single-1440-dark.avif) · [HTML](evidence/single-1440-dark.html)
- [390 px light](evidence/double-390-light.avif) · [HTML](evidence/double-390-light.html)
- [390 px dark](evidence/double-390-dark.avif) · [HTML](evidence/double-390-dark.html)

Reviewed the captured editor surfaces: the gap is visible and the blue ring is
unclipped. No live user data was used. Native OS input-method UI and real Safari
were not exercised; composition evidence uses Chromium's native CDP IME seam.
No full gate, deployment or push was performed.

## Recovered failures

- Initial capture attempt used an unscoped workspace-start test id, matching
  both home and navigation buttons. Scoped it to navigation; subsequent capture
  runs passed. Initial log: `/var/tmp/composer-capture.log`.
- One pre-rebase fast run timed out in the existing StartHere lazy-Markdown
  test while other checks ran. The immediate retry passed all 489 tests, and
  the post-rebase final run passed all 475 remaining tests (folder removal
  removed a test file). No unrelated timeout or production code was changed.
  Logs: `/var/tmp/composer-web-fast-final.log`,
  `/var/tmp/composer-web-fast-retry.log`, `/var/tmp/composer-rebased-fast.log`.
- Exploratory probes found the composer under its lowercase subdirectory,
  FontTools absent from system Python, and `taskfleet --version` unsupported.
  Used the actual path, a disposable `/var/tmp` FontTools environment, and
  `taskfleet version --output json`. No prerequisite remains missing.
