# Result

The own tab now shows a view the way the panel does: the app's `/view?id=`
page stays the tab's top-level document and frames the view full-page with
the same `sandbox="allow-scripts"` frame (`ViewFrame`, shared by panel and
tab). Before, that page replaced itself with the view host, so the view's
sandboxed, opaque-origin document was the top-level page. The gateway, the
CSP sandbox, the per-view origin and the view cookie are unchanged; the view
content in a tab additionally loses the ability to navigate the tab itself
away, as it already could not in the panel.

## Cause

What differs between the panel (works for Jari) and the own tab (CSS and
scripts missing; a single self-contained file works) is one thing: whose
document is top-level. In the panel the top-level site is the app's
(`example.test`) and the view is a same-site frame; in the own tab the
top-level document was the sandboxed view itself, whose origin is opaque.
Every request the view document sends for its own files carries
`Sec-Fetch-Site: cross-site` in both cases (measured), so they ride only on
the `SameSite=None` view cookie. Browsers that block third-party cookies
decide by the top-level site; an opaque top-level site matches nothing, so
the cookie is dropped from every subresource request and the gateway answers
401. The entry document itself is a top-level navigation and keeps its
cookie, which is why one inline file still showed. Cloudflare Access was
ruled out: Fleetrepo's `GUEST-EDITOR.md` records it absent on the app, editor
and wildcard hosts.

What was not achieved: a reproduction of the failure in a browser I can run.
A standalone repro of the gateway's behaviour (sandbox CSP on every response,
`SameSite=None; HttpOnly` cookie set on a hand-off navigation, every file
needing it; app and view hosts on a real public-suffix domain) in the
official Playwright 1.63 container loaded CSS and script in both layouts in
Chromium, Firefox and WebKit, even though WebKit there demonstrably blocks
third-party cookies (a cross-site control frame lost its cookie). Playwright's
Chromium ignored both `--test-third-party-cookie-phaseout` and the
`cookie_controls_mode` / `BlockThirdPartyCookies` settings (the control kept
its cookie), so Chrome's blocking mode could not be emulated. The fix
therefore rests on Jari's observation that the panel's configuration works
in his browser; the tab now has exactly that configuration. With `.test`
names WebKit treated every host as its own site and also lost the cookie in
the frame; that is an artifact of non-public-suffix names, not of the
product's `example.test` or the test harness's `oh.localhost`.

## Evidence

- `agent-views.spec.ts`, 2 passed: the own tab stays on
  `https://app…/view?id=…`, its view frame is `sandbox="allow-scripts"`, the
  export's stylesheet and script load inside it, the content cannot read its
  parent, the tab has no opener and the view's title, and a reload mints a
  fresh hand-off and loads again. The old page fails the first assertion.
- Web focused checks; Go `./internal/gateway` (comment change only).
- Independent review (`/llm-review`, finder gpt-6-astra, verifier
  claude-fable-5-1) confirmed one defect, fixed here: the tab mounted its
  frame only after the optional title lookup, so a stalled view list could
  outlast the 60-second hand-off grant. The frame now mounts on the mint
  alone. No other finding in the framing, the offer removal or the CLI.
- Chromium only; Safari and a Chrome with third-party cookies blocked are
  Jari's check on the test server (KOKEILTAVAA).

## Decisions for later review

- **Frame on the app's page rather than change the authentication.** The
  alternative that needs no cookie at all is a capability in the view URL's
  path (`/_s/<secret>/index.html`, relative links inherit it). It would also
  work where even a same-site frame loses cookies, but it puts a bearer
  secret in the address bar, history and the content's own `location`, and
  changes the view host's authentication model, which is a security-boundary
  decision for Jari. The frame keeps every boundary as it was.
- **The tab's address is the app's `/view?id=…`, not the view host's.** A
  reload works (it mints again) and the tab's title is the view's; the URL is
  not a copy of the view's own address.
- **No gateway enforcement that a view document is framed.** Direct opens of
  a view URL still work and stay sandboxed; refusing `Sec-Fetch-Dest:
  document` would add a rule without closing anything the frame does not.
