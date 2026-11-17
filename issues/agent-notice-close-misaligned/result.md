# Result

The notice now follows the conversation width instead of the older text-measure cap. A row wrapper accepts the stream's centered width; the card reserves the same rail gutter as adjacent replies. The close control remains at the card's right padding. Other extension cards are unchanged.

## Verification

Tested the implementation in this issue's fixing commit:

- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15300 ./scripts/test-focused.sh --area browser --spec lab-agent-notices.spec.ts`: passed, with synthetic visual capture enabled.
- From `web/`, `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15300 OH_REPLY_DELAY_MS=60 npx playwright test --config playwright.lab.config.ts tests/lab-agent-notices.spec.ts --repeat-each 3`: **3 passed**. Each repetition checks 390, 800, 1024, 1440 and 1920 px in light/dark: left/right edges within 1 px of the reply, close-button right inset, viewport containment, axe and keyboard dismissal.
- `./scripts/test-focused.sh --area browser --spec agent-notices.spec.ts`: **2 passed**, including persisted-history reopening and transient-notice lifetime.
- `./scripts/test-web-fast.sh`: passed; **229 files / 1809 tests** plus static checks.
- All test commands ran with umask 077, scratch lease and timeouts. Initial browser startup needed the documented Pi SDK fixture dependency installation; reruns passed. An intermediate implementation failed the left-edge check by 26 px; adding only a gutter then overflowed the phone viewport, which led to the row wrapper.

Synthetic lab PNG/static HTML pairs for 390 and 1920 px dark theme are kept outside the repository (conductor host, agent-keep); both screenshots were inspected. Browser tests establish synthetic layout and interaction behavior, not live-server deployment or native-user isolation. No live deployment was performed.

## Review

Focused self-review of component, CSS, timeline placements and regression assertions. This is a presentation-only change: no sessions, wire contracts, daemon state or authority boundaries changed, so an independent model review was not warranted. Dismissal still returns null before the wrapper is rendered.

## Decisions for later review

- Used 1920 px for the unspecified wide viewport, in addition to the four explicitly requested widths. This exercises the capped desktop column; a still wider viewport would keep the same column width.
- Matched the reply card's left edge, excluding its timeline rail, rather than the outer rail edge; this meets the requested card-edge alignment without shifting replies.

## Live check

In a conversation containing an agent notice and a reply, check that their left and right card edges match. Resize from phone to wide desktop in light and dark themes. The close button should remain at the notice's right padding and dismiss the notice without removing surrounding messages.
