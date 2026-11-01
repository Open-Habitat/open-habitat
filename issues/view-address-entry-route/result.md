# Result: open stable view addresses privately or publicly

## What landed

- Gateway `GET /n/<entry>` on the app origin (`viewEntry` in
  `internal/gateway/view_links_linux.go`). A public address (store usable,
  site sharing on, publication current, owner not denied: the same
  `servableLocked` check the content host now uses on every request) answers
  302 to its content URL, for the owner too. Anything else (private, expired,
  paused, deleted, unknown, malformed) gets the app shell, the same bytes for
  everyone. Every answer is `no-store`, `no-referrer`, `noindex`. A query
  string is ignored, never forwarded. Entry secrets are indexed by hash and
  compared in constant time.
- `POST /api/v1/view-addresses/open {entry}` (CSRF): the signed-in person's
  page learns which of *their* addresses the secret names. Another person's,
  a deleted and an unknown address all answer the same
  `404 view_address_not_found`. It works with public sharing off. Contract
  `openRequest`, example and negative checks; generated types.
- Sign-in return: `uiReturn` accepts exactly `/n/<43 base64url>`. The
  pending flow keeps it server-side, so the provider URL never carries it;
  `/auth/github/start` answers `Referrer-Policy: no-referrer`.
- Web: `ViewOpenPage` is also the standalone page at `/n/<entry>`. Signed
  out, it offers sign-in and names nothing. As the owner, it resolves the
  secret in a body and frames the view through the existing hand-off, which
  keeps relative assets. Otherwise it says the view is not available. The
  `/view?id=…` launcher now ensures the reservation and replaces itself with
  the entry address. When it cannot (at the cap, store unavailable), it
  frames the view directly as before.

## Tests

- `scripts/test-focused.sh --area go --go-package ./internal/gateway`
  (race). New: `TestViewEntryAddressOpensPrivatelyOrPublicly` covers
  identical shells for owner/other/anonymous/unknown/malformed, the open
  API's ownership and refusals, private open with sharing off, public
  redirect incl. `?fbclid=`, pause/deny/expiry/private/delete, and no secret
  in the diagnostics. `TestViewEntrySignInReturnsWithoutTellingTheProvider`
  covers start→callback returning to the entry, no referrer, rejected
  return shapes and logs.
- Contracts focused check; web focused check (1198 tests, new
  `ViewOpenPage.test.tsx`).
- Browser: `view-links.spec.ts` with a new test (own tab at `/n/…`,
  anonymous sign-in prompt, public redirect to the content host, wrong owner
  "not available", sign-in return frames the view, no request or referrer
  carries the secret). Also `agent-views.spec.ts` (own tab now at `/n/…`
  with sharing off), `worker-view.spec.ts`, `ui-language-views.spec.ts`.
- Review: independent `/llm-review` (finder claude-fable-5-1, verifier
  gpt-6-astra) and `/assess-findings`. One confirmed defect fixed (a query
  string on a public entry showed the sign-in page). One DISCUSS item, below.

## Decisions for later review

- **No Access-pin exception for the entry route.** The ADR mentions a
  narrow public-resolution exception in gateway Access handling. The content
  host was left behind `accessIngress` in unit 2, and `docs/operations.md`
  says links open only for people past the gateway's access pin. Exempting
  only `/n/` would redirect to a content host that refuses. Exempting both
  changes who reaches the gateway without authentication, which is a
  security-boundary decision. Kept consistent and closed. Alternative: exempt
  GET/HEAD `/n/` and view hosts together.
- **Private open via a POST resolve, not a server-side redirect.** The tab
  stays at `/n/…` (the ADR's launcher "replaces itself with the entry
  address"). The secret never enters a query string. The alternative of
  redirecting the owner to `/view?id=` would lose the stable address in the
  bar.
- **Sign-in from the page carries the secret in `return_to`.** This is the
  existing login flow the ADR names. The query is never logged by the
  gateway, and the page and the start response send no referrer.
  Alternative: a separate opaque return handle, which would be a new store.
  Ingress logs of the start query belong to unit 5's verification.
- **Every own-tab open reserves.** The `/view?id=` launcher ensures on each
  open, so a view opened once in its own tab counts toward the 1000-address
  cap. At the cap it still opens directly.
- **Invalid or unknown entry shapes get the shell (200), not 404.** That
  keeps all non-public answers byte-identical. The page then says "not
  available".

## Remaining gaps

The card's *Kopioi linkki* and Settings still copy `content_url`. Switching
them to the entry URL is unit 4. Real ingress (log, cache and Access
behaviour) and separate Unix users are unit 5.
