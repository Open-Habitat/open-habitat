# Result

The complete trailing worker group (branch, state ball and wait badge) now becomes transparent under the hover/focus action overlay. Its space stays reserved. Existing age/workspace trailing labels already yield to that overlay. No controls, translations or Explain cards were added.

Navigation.tsx already supplies worker state through the link's visually hidden `aria-describedby` text; hiding the decorative group does not remove that information. No component change was necessary.

## Evidence and checks

Based on f5634ad0f plus this issue's CSS/test change. Synthetic host-backed lab only; no live host or native provider claim.

- Before/after screenshots and adjacent offline HTML in `evidence/`: 1440px rest, hover and keyboard focus; 390px touch rest. All captured at device scale factor 2 and converted with `scripts/screenshots-to-avif.py`. Inspected the before/after hover images: the branch and ball protrude beside Archive before, and disappear afterwards. Touch keeps its inline, non-overlapping actions.
- `OH_PORT_BASE=13800 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec <name>` for every `ls web/tests | grep -i rail` result, individually: 21 tests passed across ten specs, including the new `rail-hover-marks.spec.ts` (pointer and touch), existing keyboard archive and accessibility checks.
- `./scripts/test-focused.sh --area web`: 194 files / 1460 tests passed, static and component checks passed. After rebasing onto concurrent main landings: 194 files / 1463 tests passed, and both `rail-hover-marks.spec.ts` cases passed again. The first post-rebase web run hit the existing GitLabConnection form test's 5-second timeout; the full unchanged rerun passed. No persistent failure was reproduced.
- Focused self-review: selectors use the same hover-capability, hover/focus and action-presence conditions as the overlay; opacity retains geometry and accessibility; link and action-button focus keep the marks hidden; moving focus outside restores them. Touch remains unchanged. No authority or state path changes.

Initial web check caught formatting of the added CSS selector; formatted it and reran successfully. An initial repeated-`--spec` invocation ran only the last spec, so all ten were subsequently run individually. Initial source lookups guessed nonexistent CSS/ListRow paths; located the actual sources. `magick` was unavailable; installed `convert` successfully produced disposable PNG crops for visual review. These were tooling corrections, not remaining failures.

## Decisions for later review

- Keep touch marks visible beside the permanently inline actions, rather than suppress them permanently: there is no overlay or overlap on touch, and the brief asks to retain today's touch actions. Desktop hover/focus hides the entire group rather than only the branch, preventing the state ball or wait badge from protruding too.
- Reuse the existing accessible description rather than duplicating worker state in the accessible name. It remains present on focus and the regression checks the unchanged description, without pinning translated wording.
