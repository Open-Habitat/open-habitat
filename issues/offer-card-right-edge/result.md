# Result

Timeline view and file offers now use the conversation column instead of the older text-measure cap. A row wrapper accepts the centered column width, and the card reserves the same rail gutter as replies. The chevron stays at the right padding. Offer cards outside the timeline are unchanged.

## Verification

Tested the code in this fixing commit:

- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=16300 ./scripts/test-focused.sh --area browser --spec lab-offer-edges.spec.ts --spec lab-offer-layout.spec.ts`: **3 passed**, with synthetic capture enabled through `OH_OFFER_EDGES_EVIDENCE`.
- From `web/`, `OH_BROWSER_WORKERS=2 OH_PORT_BASE=16300 OH_REPLY_DELAY_MS=60 npx playwright test --config playwright.lab.config.ts tests/lab-offer-edges.spec.ts tests/lab-offer-layout.spec.ts --repeat-each 3`: **9 passed** on the final code. The new spec checks view and file cards at 390, 800, 1024, 1440 and 1920 px, light/dark: both edges within 1 px of the reply, viewport containment and chevron right inset. Existing pointer/touch corner-action checks also pass three times.
- `./scripts/test-web-fast.sh`: passed, **232 files / 1870 tests**, static checks and TypeScript. Initial runs exposed formatting, callback-return lint and image-element typing errors in the new capture code; these were fixed before the final green runs.
- Browser and fast checks ran with umask 077, scratch lease and timeouts.

Synthetic PNG/static HTML pairs at 390 and 1920 px in both themes, plus command logs, are retained outside git at `/var/tmp/agent-keep/offer-card-right-edge/`. The phone dark and desktop light screenshots were inspected. These are host-backed synthetic layout checks, not live deployment evidence. No live deployment was performed.

## Review

Focused self-review of timeline placement, scoped CSS and browser assertions. This changes presentation only: no sessions, contracts, daemon state or authority boundaries. An independent model review was not warranted. Generic cards retain their existing width cap, and the existing no-view-controls early return remains intact.

## Decisions for later review

- Put the wrapper at the timeline notice entry rather than around every reusable offer card: only timeline offers need the reply rail gutter; story and other card contexts keep their current layout.
- Match the reply card itself, excluding its timeline rail, consistent with the notice fix.

## Live check

In a conversation with a view offer, file offer and reply, compare both card edges from phone to wide desktop in light and dark themes. The offer edges should align with the reply and the chevron should remain at the right padding. Hover or keyboard-focus an offer and check that its corner actions still appear without squeezing the title.
