# Result

All three gate failures were stale browser selectors, not a product regression or load flake. Commit `e38da04c` replaced the appearance settings' segmented theme control with `ChoiceMenu` so four labels fit a phone; the account-menu segments intentionally remained unchanged. The three journeys still expected the settings group and its removed segment buttons. Each failed alone on starting revision `a035742e` (product tree from `6154634c`) at precisely those selectors.

Updated only the two browser specs to open the settings choice menu. High contrast still checks persistence, the selected menu item, system media changes and pre-bundle bootstrap. Account settings still checks native state, route return and disconnect. The phone journey additionally checks the actual applied theme and absence of horizontal overflow while the appearance detail is visible, not only after returning to the settings list.

## Validation

On `a035742e` plus this test-only diff, with `OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=15700`, default focused reply jitter and a 240-second timeout per isolated invocation:

- `./scripts/test-focused.sh --area browser --spec theme.spec.ts --tag 'Korkea kontrasti'`: failed before; passed 3/3 separate invocations after.
- `./scripts/test-focused.sh --area browser --spec account-settings.spec.ts --tag 'verified native state'`: failed before; passed 3/3 separate invocations after.
- `./scripts/test-focused.sh --area browser --spec account-settings.spec.ts --tag 'compact phone drawer'`: failed before; passed 3/3 separate invocations after, including axe.
- `./scripts/test-focused.sh --area browser --spec account-settings.spec.ts --spec theme.spec.ts`: 21 passed.
- `./scripts/test-focused.sh --area web`: static checks and 216 files / 1674 tests passed.
- Focused self-review: selectors match the production control's semantics; no assertions removed from the journeys, no delays or timeout increases, account-menu coverage unchanged.

These are host-backed synthetic checks, not live provider or Unix-user-isolation evidence. No full suite or clean gate was run; integration gate belongs to the conductor. No product UI changed, so no new visual capture was needed.

The supplied old gate artifacts were unavailable. An initial browser attempt stopped at the missing Pi SDK prerequisite; installing the pinned fixture dependencies resolved it before reproduction. Routine path probes also found the absent web dependencies and a nonexistent alternate Account source path; the correct component was inspected. The focused runner's help invocation prints usage with exit 2. None prevented final validation.

## Decisions for later review

Keep the dropdown introduced in `e38da04c` and update the stale specs rather than restoring segments: the dropdown preserves the intentional narrow-layout fix and all three original behaviors pass through it. No product decision or authority change was required.

Live check: on the test server, open Settings → Appearance on a phone, choose dark or high contrast, return to the settings list and back; verify the selected theme persists and the page does not scroll horizontally. This change updates test coverage only.
