# Single outage warning and aligned send button

## Decisions for later review

- The application-wide connection banner is the one visible warning when the HTTP snapshot is unavailable, even if the conversation status is also stale. The conversation's stale-status notice is the one warning when only the conversation status needs rechecking; an event-stream or missed-event notice likewise owns its own state. A blocked send still has an accessible description at the field, but it does not repeat these notices visually. An unrelated reason, such as an unknown archive state, stays visible beside its control.
- The earlier fix hid a duplicate reason **beside the button** when the field already had one, but did not account for the separate application-wide outage banner and the field's own disabled-reason line. It also tested geometry for an idle composer; this case remained in working/steer mode with a disabled button. The button stack now occupies the editor's grid row and its offset is independent of the text below the field.

## Evidence

`lab-before.{png,html}` and `lab-after.{png,html}` are paired screenshots and static HTML captured from the synthetic lab with a working Pi turn, a draft, and a failed snapshot refresh. They are not live-host captures. The after view has one visible connection warning and keeps the send button at editor height. The host-backed browser test checks the same state geometrically, in addition to the idle-outage check.

## Validation

`./scripts/test-web-fast.sh`, `resilience-states.spec.ts` (10/10 including scoped Axe on the working composer), and the archive continuation browser rerun passed. The full `browser-conversation.spec.ts` run passed 70/71; its unrelated archive navigation case timed out once and passed on isolated rerun. The initially missing `web/node_modules` blocked the first lab build; `npm ci --prefix web` restored it. Earlier fast-check and browser assertions failed during implementation (format, a type mismatch, and a strict locator matching both disabled reasons); these were corrected and rerun. The clean gate is run on the final committed tree before merge; its result and receipt are reported in the worker close.
