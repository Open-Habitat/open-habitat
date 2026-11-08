---
created: 2026-11-08
updated: 2026-11-08
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: browser spec run in taskfleet worker
source_ref: taskfleet:01m6y5wmcfs49saf901vkk6608/test-failure:phone-composer-helper-selector
originating_run: 01m6y5wmcfs49saf901vkk6608
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-11-08
---

# browser-conversation phone composer helper uses a selector the composer stack broke

## Description

## Observed failure

On main at fca07abdc (after 9881ef7fb "give the composer stack one spacing rhythm"), four `browser-conversation.spec.ts` cases fail in the shared helper `expectPhoneComposerWithinViewport` (web/tests/browser-conversation.spec.ts:31): `expect(page.locator(".ah-conversation-frame > .ah-composer")).toBeVisible()` finds no element.

Failing cases (named spec run, `OH_BROWSER_WORKERS=2`):
- `@browser-conversation validated pending send receipt never reposts`
- `@browser-conversation validated rejected send receipt never reposts`
- `@browser-conversation validated uncertain send receipt never reposts`
- `@browser-conversation settled turn uses its native strip without a duplicate receipt`

## Cause

9881ef7fb wraps the composer in `<div className="ah-composer-stack">` (web/src/app/BrowserConversation.tsx), so `.ah-composer` is no longer a direct child of `.ah-conversation-frame`. The helper's child selector is stale; the phone-width bound checks after it never run.

## Direction

Select `.ah-conversation-frame .ah-composer-stack > .ah-composer` (or the composer's own test id) in the helper. Other specs with the same pattern: `resilience-states.spec.ts:331` and `worker-view.spec.ts:164,174` could be checked too.

Seen while running the named spec for `resend-proven-undelivered`. That work does not touch the helper, and the pending and rejected cases do not exercise its change.
