# Result: owner-only HTML views

ADR 0032 (`docs/decisions/adr-0032-agent-html-views.md`) records Jari's
option C as accepted. This issue implements its first, owner-only part.

## What exists now

- **Agent side.** `open-habitat agent view offer|list|remove` on the own-UID
  agent listener (`/agent/v1/views`, `/agent/v1/views/remove`). An offer
  freezes a workspace HTML file, or a directory with `--entry-file`, into
  `~/.local/state/open-habitat/views/<view_id>/` (files plus a manifest),
  staged and published with one rename. Symlinks, special files, mounts and
  traversal refuse the offer; dot-entries are skipped and counted; at most
  500 files and 50 MiB. With `--current`/`--conversation` the offer is a native
  notice carrying the view (written through Pi's own writer, like any notice);
  without one it is an account offer published as a `view.offered` event. The
  reply says published, never seen. The skill and the native host context
  tell a Habitat agent how to use it.
- **Gateway.** `oauth.view_origin` (from `site.json` `views.origin_template`)
  turns on `/api/v1/views` (the person's list), `POST /auth/view` (a one-minute,
  single-use handoff URL) and the per-view hosts. A view host's label is
  derived from the authenticated identity and the view ID. Redeeming the
  handoff sets `__Host-oh-view` (host-only, Secure, HttpOnly, SameSite=None),
  which is valid only on that host, only while its app session lasts, and
  only for reading that export through the owner's daemon on the fixed
  `/view-export/<id>/<path>` route. Every view-host response, errors and the
  reserved namespace included, carries `sandbox allow-scripts` with
  `connect-src 'none'`, sources limited to that exact host and
  `frame-ancestors` the app.
- **Browser.** The offer card (`ViewOfferCard`) has Avaa and Avaa omalle
  välilehdelle. The right-hand panel (`ViewPanel`/`ViewSplit`, header like
  `EditorHeader`, with expand, own tab and close; Escape closes and focus
  returns to the card) frames the handoff URL with `sandbox="allow-scripts"`.
  The own tab opens the app's `/view?id=` page with `noopener`, which mints
  and replaces itself. Account offers wait in a corner tray. Without a view
  origin no card is shown.

## Checks

- `./scripts/test-focused.sh --area contracts`: pass.
- `--area go` for `./internal/gateway`, `./internal/daemon`, `./internal/cli`,
  `./internal/host`: pass; `go test ./test/browser-host`: pass.
- `--area web`: 119 files, 749 tests pass.
- `--area browser --spec agent-views.spec.ts`: 2 pass. It proves in Chromium
  that the sandboxed page's scripts and stylesheet load through the view
  cookie, that it cannot read cookies, its parent, storage or the network,
  that no request to a view host carries the app or editor cookie, that
  direct opens and errors carry the CSP, and the own tab has no opener.
  Switching the view cookie to Lax makes it fail (the page's own script
  never loads), which is why the cookie is `SameSite=None`.
- Whole suite `npm run test:browser --prefix web`: see "Whole browser suite".
- The spec also passes with Chromium's `--test-third-party-cookie-phaseout`
  flag; whether that flag is effective in Playwright's headless build was not
  verified, and Safari and Firefox were not tried.

All of this is same-UID synthetic evidence. Real hostnames, wildcard TLS and
two distinct Unix users are not exercised; the test server is the first place.

### Whole browser suite

The first whole-suite run failed 52 onboarding cases. Cause: the split
wrapper changed those pages' layout (an onboarding footer covered its
buttons). Fixed by making the wrappers `display: contents` while no view is
open, and by resetting the host's own state on a new identity instead of
remounting the page. `first-use-ux.spec.ts` passes on main and again here.
The second run showed `loading-landing` (the app's 404 for the view list
logged a console error; the list is now an empty 204 without a view origin)
and `native-history` title (fixture history lines put the type later, so the
title-scanner guard keeps its old refusal for untyped long lines). The third
run had one failure, in the untouched `browser-editor-concurrent.spec.ts`
(an agent change shown as imported rather than pending), which passed twice
alone: a timing flake under full load, not filed. The final run, after
the review fixes, passed all 377 cases (3 skipped).

## Review

Independent `/llm-review` at critical rigor on the final diff. The finder was
claude-opus-5-5: gpt-6-astra (codex 401 on Birch) and claude-fable-5-1 (CLI
exit 1) were unavailable, deepseek-v4-pro and gemini failed on the payload, so
no second-provider verifier ran and every finding was confirmed locally.
`/assess-findings`: 4 FIX, 1 DROP. All four fixes are in the branch:

- a view host refused file names browsers send unescaped (`kuva (1).png`);
  now only encoded separators are refused;
- a daemon `view.offered` event enabled offers in the browser even without a
  view origin; now only the list does;
- a derived title over 200 bytes published an export its own reader rejects;
  now the title is shortened and an invalid summary is refused before export;
- `agent view remove --dry-run` searched a list capped at 200; the daemon now
  answers the dry run.

Dropped: `/healthz` and `/readyz` on a view host lack the view CSP (fixed
JSON, not content). The cookie-blocking question above stays open. The
isolation, confinement, CSP and authority paths held in the finder's own
tracing and in the tests.

## Found on the way

The longer native host context pushed Pi's stored system-prompt line past
the 16 KiB buffer of the title scanner, whose guard then refused every name
in a session under 64 KiB (`TestPiRPCNativeSyntheticProvider` failed). Real
system prompts with skills are already longer, so short conversations on
live hosts likely lose their titles. The guard now looks at the entry type
Pi writes first; `TestNativeNameSurvivesLongSystemPromptLines` covers it.

## Decisions for later review

1. **A frozen export is a copy in the owner's home**, not a live link to
   the workspace. Alternatives: serve the workspace path live (the view
   would change under the person, and the reader would need workspace
   confinement per request), or hash-pinned manifests over live files.
   The copy is what "frozen" means, is the research's export, and lets the
   reader confine itself to one directory.
2. **Exports are never removed automatically.** `agent view remove` removes
   one; the directory is otherwise the person's. Alternatives: expiry or a
   count cap. Destruction is explicit in this product, and quota bounds it;
   on an installation without quotas it can fill the shared disk like any
   other file the agent writes.
3. **The view host label is derived (SHA-256 of identity and view ID)**, not
   random per open. Two opens of one view share an origin, two views or two
   people never do, and no registry maps hosts to views.
4. **The view cookie is `SameSite=None`.** A sandboxed (opaque-origin)
   document's own subresource requests are cross-site, so Lax or Strict
   breaks every multi-file view (verified in Chromium). The cookie is
   host-only on its one view host, reads one export, the host has no
   state-changing route and only the app may frame it. Browsers blocking
   third-party cookies (Chrome incognito, Safari) may still not send it from
   a sandboxed frame; a single-file view then still shows (the entry is a
   top-level or frame navigation), its extra files may not. Not tested.
5. **The handoff is a GET with the one-time token in the query**, redeemed on
   the view host, because a sandboxed page cannot POST to its own host with
   cookies. The token lives 60 s, is consumed on first use and is followed by
   redirects, so it does not stay in the tab's history; `Referrer-Policy:
   no-referrer` keeps it out of referrers.
6. **The own tab goes through the app's `/view?id=` page**, opened
   synchronously with `noopener`, which mints with its own CSRF and replaces
   itself. Alternative: mint first and open the minted URL, which popup
   blockers stop after the async request.
7. **A conversation offer is a notice carrying a `view`**, written through
   Pi's notice writer; no new native entry type or Pi bridge operation. An
   offer to a conversation that is not running is refused before copying.
8. **Account offers** (no conversation) are a `view.offered` event plus the
   list on load, limited to the five newest of the last 24 hours, dismissible
   per tab. No account tray beyond that.
9. **The daemon cannot know whether the installation has a view origin**, so
   an offer on an installation without one succeeds and shows nothing. The
   skill says so.
10. **The panel header has three controls**: expand (as the editor's), open
    in own tab (round 2's pop-out, the panel stays open) and close. The phone
    panel covers the conversation; expand is hidden there.
11. **Content types are the gateway's allowlist by extension**; the daemon
    sends only octets and the gateway ignores its headers. The view frame
    has a white canvas (`--ah-content-canvas`) in both themes, as a browser
    tab would.
12. **`site.json` `views.origin_template`** is optional and not tied to a
    profile (the editor's is tied to the editor profile). It must not overlap
    the editor template; the gateway refuses an overlapping configuration at
    start too.

## For the conductor: test server configuration

Fleetrepo's test `site.json` needs
`"views": {"origin_template": "https://oh-view-*.<test domain>"}`
beside `editor.origin_template` (same single-label form, e.g.
`https://oh-view-*.example.test` next to `oh-code-*`), and the matching
wildcard DNS name and ingress route `oh-view-*.<domain>` to the same gateway
listener with the Host header preserved and the same access policy, covered
by the existing `*.<domain>` certificate. No unit or socket changes.
