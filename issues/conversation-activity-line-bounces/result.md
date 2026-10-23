# Result

The empty text block was becoming a stage-ending reply card. Even with no visible Markdown, the card and grid gap took space below the activity strip; the bottom-filled conversation therefore lifted the strip until the placeholder disappeared. `AgentTurn` now ignores whitespace-only text when grouping stages, and selects the final answer from those visible stages. Real text still grows the conversation normally. No CSS, application state, contracts, Go, editor or settings changes.

The new Storybook `StreamingActivity` example and browser fixture exercise thinking, three tools, empty/whitespace text, placeholder removal and actual text deltas. A component test also covers settlement with a trailing empty block. The browser regression measures the activity line across updates at 1440 and 390 px (maximum allowed unexplained movement: 1 px).

## Verification

Tested runnable-source revision: `484a77d7` (sources frozen before final checks; the following evidence-only commit does not change executable inputs).

- `npm ci --prefix web`: passed.
- `OH_WEB_WORKERS=2 ./scripts/test-focused.sh --area web`: passed format, lint, typecheck and all 534 tests in 92 files.
- `./scripts/test-focused.sh --area browser --spec activity-line.spec.ts`: 2 passed, including layout measurements and axe after expanding work.
- `./scripts/test-focused.sh --area browser --spec quiet-work.spec.ts`: 2 passed (disclosure anchoring, button identity, reduced motion and axe).
- `./scripts/test-focused.sh --area browser --spec native-live-join.spec.ts`: 1 passed (real controller/native-history catch-up, no duplicate turn).
- `./scripts/test-focused.sh --area browser --spec lab-activity-line.spec.ts`: 1 passed, four light/dark desktop/mobile captures and axe checks.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, `git diff --check`: passed. Doctor retains the repository's existing raster-image/large-binary advisories; the four new PNGs are under 80 KiB each.

## Visual self-review

`review/activity-{1440,390}-{light,dark}.{png,html}` are paired screenshots and inert HTML from the host-backed synthetic lab, with the real controller and held fake Pi. All four were inspected against `issues/live-turn-flicker/prototype-tool.png` and the accepted stage-card direction in `issues/proto-interim-replies/screenshots/3-vaiheet-elava.jpg`: rail, work disclosure, activity, clock and interim card keep their existing token-based appearance. No new spacing or presentation rule was needed. The mobile activity strip remains visible. This is human comparison material, not an automated pixel comparison or a live-provider reproduction.

## Failed attempts and limits

- The pre-fix browser regression failed at both widths because the empty block mounted a reply card. This was the intended red regression run; the fixed run passes.
- The first web check caught a formatter second-pass difference in the new browser test. Reformatted and reran.
- The next web check caught a missing required `size` prop in the new fixture's control. Added it and reran.
- An exploratory `fleetrepo-exec command show` for dependency installation returned `placement_denied` (installation is native). Used the required ordinary `npm ci --prefix web`, which succeeded. Browser commands used the installed remote warm-workspace route; no local browser bypass.
- The first complete web run passed 533/534 tests but timed out (5 s) in the untouched Integrations sign-in-dialog case. The same required focused command with `OH_WEB_WORKERS=2` passed all 534 tests, without changing tests or increasing timeouts.
- No real-provider/live-session reproduction; no full clean gate, Go or contract checks because those boundaries did not change.
