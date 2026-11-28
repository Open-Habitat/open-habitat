---
created: 2026-11-28
updated: 2026-11-28
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed in a cross-engine Playwright run
source_ref: taskfleet:01m8gc0zcga2wtf5hmcjxah6zj/webkit-view-session-cookie
originating_run: 01m8gc0zcga2wtf5hmcjxah6zj
originating_run_kind: spinoff
---

# Private views do not open in WebKit's frame: the view session cookie is not sent after the hand-off

## Description

## What happens

In Playwright's WebKit build on Linux, a private view opened in the panel
never loads its content. The panel frames the one-time hand-off URL on the
view host; the hand-off answers `303` with the `__Host-oh-view` cookie
(`Secure`, `HttpOnly`, `SameSite=None`, host-only) and `Location: /`. WebKit
then requests `/` on the view host without any cookie, and the gateway
answers `401` with the "the view's session has ended" text. Both requests are
`Sec-Fetch-Dest: iframe`, `Sec-Fetch-Site: same-site`.

A published view opened at its content address as the top-level page works
in the same WebKit build (it needs no cookie), as does everything in
Chromium and Firefox.

## Reproduce

1. `npx playwright install webkit` (or the `mcr.microsoft.com/playwright`
   image matching the pinned Playwright version, which carries WebKit's
   system libraries).
2. Run `web/tests/view-frames.spec.ts` with
   `playwright.engines.config.ts --project webkit` after removing the
   WebKit skip in its panel case: the first assertion (`data-script` on the
   view's body) fails, and the trace shows the cookie-less `/` request.

## Not yet known

Whether desktop or iOS Safari behaves the same. WebKit blocks cookies in
frames whose site differs from the top-level site, and the view namespace is
meant to be a sibling of the app on the same site, so the outcome may depend
on how the installation's names fall on the public suffix list and on how
WebKit's Linux cookie store differs from Safari's. If Safari does the same,
no private view opens in Safari at all.
