# Result

The pending wake bar was a direct flex child of the composer stack without the inner column inset. The stack already supplies the conversation's maximum width. The bar now shares the notice-stack column rule using the existing inline-padding token, and shares the stack's vertical spacing rather than adding its own bottom margin.

Checked the neighboring notice layouts: notice-stack already had the correct inset (preserved by the shared rule); conversation/actionable notices, recap and permission dock have their own column rules. Rest cards live inside the transcript's constrained children. No second instance of this defect was found.

## Verification

Tested the implementation diff on base `06622cb6c70f9b916dbf24b7ae90600a09a3ca86`:

- `./scripts/test-focused.sh --area web`: passed, 255 files / 2143 tests, plus static and component checks.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15300 ./scripts/test-focused.sh --area browser --spec scheduled-wake.spec.ts`: 2 passed, including accessibility and existing move/cancel/archive/undo behavior.
- `npx playwright test scheduled-wake.spec.ts --repeat-each 3` from `web/`, with two workers and 60 ms reply jitter: 6 passed.
- Layout assertions compare both horizontal edges of the wake bar to the composer surface and agent-turn container within 1 px at 1280, 1440, 1920 and 390 px.
- Synthetic screenshots and HTML captured with `OH_WAKE_CAPTURE` at `/var/tmp/agent-keep/wake-notice-not-aligned/wake-{1280,1440,1920,390}.{png,html}`; desktop and phone images inspected. No installation data was captured or committed.

An initial browser attempt was blocked by the missing pinned Pi test dependency; installing it resolved the prerequisite. The first version of the assertion used an obsolete composer selector; corrected to the current composer surface before the passing runs.

Focused self-review: low-risk CSS-only product change, no session, contract, daemon or authorization changes. Reviewed selector scope, inherited maximum width, phone wrapping and preservation of sibling notice geometry. Independent model review was not warranted. No full browser suite or clean gate was run; no deployment/live-server acceptance is claimed.

## Decisions for later review

None: preserve the existing conversation column and component appearance; only apply its shared inset and spacing to the wake bar.

## Live check

After deployment, open a conversation with a pending scheduled wake. At desktop widths and on a phone, compare the wake bar's left and right edges with the composer and transcript column. Move and cancel the wake; controls should remain usable without horizontal overflow.
