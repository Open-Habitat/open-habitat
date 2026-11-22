# Result

The viewport-owned app frame now locks document scrolling and stops scroll chaining at the frame and ordinary page scroller. Conversation and rail scroll regions retain their existing containment. The landing/sign-in document remains scrollable.

The shell previously copied every `visualViewport.offsetTop` into its fixed top position. That included non-keyboard viewport movement, making otherwise inert chrome move with a swipe. Pan compensation now applies only when the existing keyboard-height detector identifies a keyboard, and negative offsets are not followed. Native pinch zoom remains untouched; no touch handlers or `window.scrollTo` compensation were added.

## Evidence

Tested runnable revision: `9c820e4f7` (tests ran on the identical runnable files before committing).

- `./scripts/test-focused.sh --area web`: static checks and 255 test files / 2,143 tests passed.
- `./scripts/test-focused.sh --area browser --spec phone-composer-keyboard.spec.ts`: four cases passed.
- `cd web && npx playwright test tests/phone-composer-keyboard.spec.ts --repeat-each 3`: all 12 passed with two workers and 0–60 ms reply jitter. CDP touch swipes cover header, composer, short transcript/empty space and drawer footer in both directions. During gestures, document offsets remain zero and shell, header and composer positions stay fixed. A long transcript still scrolls with touch. Existing keyboard-pan, late-overview and latest-turn visibility checks remain green.
- `./scripts/test-focused.sh --area browser --spec phone-sign-in.spec.ts --spec lab-page-scroll-header.spec.ts --spec lab-rail-scroll-region.spec.ts`: 11 passed, including phone sign-in, desktop/phone frame accessibility and drawer/rail scrolling.
- Regression experiment: restoring the unconditional viewport-offset assignment made both new cases fail with shell top 45 instead of zero. Restored the fix before final tests.

All runs used `umask 077`, scratch leases, bounded timeouts and `OH_PORT_BASE=16300`; browser runs used `OH_BROWSER_WORKERS=2` (lab also two). Logs and synthetic phone PNG/HTML captures are retained outside git at `/var/tmp/agent-keep/phone-whole-window-scrolls/`. The iPhone-profile image was inspected: header and composer remain within the viewport with empty transcript space between them.

These are host-backed synthetic Chromium runs using iPhone 13 and Pixel 7 device characteristics at 390 × 844. Safari elastic viewport events and OS keyboard changes are simulated explicitly. No real-device Safari/Android browser or installed-server check was run; those remain the live check below. Initial test setup failures (device worker option in a nested group, then a duplicate hidden close button) were corrected before the passing runs. No required automated check remains blocked.

## Review

Focused self-review, appropriate for a small CSS/viewport-only change with no session, contract, daemon-state or authorization changes. Checked scope removal on unmount, ordinary-page versus conversation scrolling, drawer behavior, keyboard pan and unchanged pinch-zoom handling. The behavioral regression experiment and adjacent browser cases support the change; no independent model review was required or claimed.

## Decisions for later review

- Keep document locking scoped to the existing rail-bearing viewport-owned frame rather than all routes. This preserves document scrolling for landing/sign-in and no-rail setup pages.
- Reuse the existing keyboard-height detector rather than introduce device-specific gesture cancellation. Non-keyboard pan is ignored; keyboard pan remains supported. This avoids blocking selection, zoom or genuine inner scrolling.

## Live check

On a phone, swipe up and down on the conversation header, composer edge, empty space in a short conversation and the navigation drawer footer. The whole page must stay still. Scroll a long transcript and drawer list: their content must move without moving the frame. Repeat with the on-screen keyboard open, dismiss it, and check that the composer remains visible. Check pinch zoom and sign-in-page scrolling too.
