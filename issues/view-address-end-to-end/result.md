# Result: stable view addresses through the real ingress

The live run on the disposable test server found no product defect. All 61
checks passed in the final run. Product code is unchanged; this unit adds the
operator's ingress log/cache rule to `docs/operations.md`, records ADR 0035's
authority rules in `internal/AGENTS.md`, and removes ADR 0035 and the ADR 0033
it amended now that their implementation has landed.

## Environment

- **Server:** `https://open-habitat-test.example.test`, release
  `0.0.0-pilot.688` (product `c65f3140`, which includes all four earlier
  ADR 0035 units). Views on `https://oh-view-*.example.test`,
  `view_link_max_days = 90`.
- **Ingress:** the real public path: Cloudflare edge and the shared tunnel
  on Alder, then Alder's `omega-forward` to the guest gateway on
  `127.0.0.1:8443`. No Cloudflare Access app covers these hosts, and the
  gateway's `oauth.access` pin is not installed there.
- **Browsers:** headless Chromium (Playwright 1.65, build 1243) on Birch
  reaching the public URLs over the internet. It ran four contexts: two
  signed-in people, a stranger with no session, and a recipient whose
  cookies are blocked (every `Cookie` request header and `Set-Cookie`
  response header stripped). It was launched with
  `--test-third-party-cookie-phaseout`.
- **People:** four synthetic accounts with separate Unix users,
  `oh-e2e-alice`, `oh-e2e-bob`, `oh-e2e-carol` and `oh-e2e-dave` (UIDs
  21035–21038; synthetic GitHub subjects 9100000001–9100000004). Each was
  admitted and created through the real broker (`admit`, then `ensure`, sent
  as the gateway UID). Each got a workspace and a native Pi conversation
  through `open-habitat agent`. Its exports were offered with
  `agent view offer` from a five-file site: `index.html`, a CSS file, a
  script, an SVG in `assets/img/`, and `sub/page.html` linking back with
  `../`. GitHub OAuth cannot be done for synthetic subjects. Instead, root
  wrote one browser session per account into the gateway session store while
  the gateway was stopped. Everything after that, including cookies, CSRF,
  sessions and broker checks, ran through the production gateway.
- **Harness:** [live-e2e.mjs](live-e2e.mjs) holds the root steps on the guest
  and the browser and HTTP checks. Its output, with every secret replaced by
  a label, is [live-e2e-result.json](live-e2e-result.json). The final run
  used carol (owner A) and dave (person B).

## Scenario matrix (final run, 61/61)

| Scenario | What was verified live | Result |
|---|---|---|
| Two people + anonymous, private | Ensure returns one private reservation, and repeating it returns the same address. For an anonymous browser, a private entry and a made-up entry give byte-identical app pages with no redirect and no title or owner, sent `no-store`, `no-referrer`, `noindex`, no cookie, `cf-cache-status: DYNAMIC`. The content URL answers 404. Person B's `open` answers exactly like an unknown entry, B's list does not include A's address, and B's browser gets no frame. A's browser frames the multi-file view on the app origin, and its script runs. | pass |
| Sign-in from a private entry | A stranger presses sign-in on a private entry. None of the four requests to github.com carries the entry secret, in the URL or in `Referer`. The gateway journal has no `return_to`. | pass |
| Publish, both URL forms | The entry stays the same. Anonymous GET and HEAD give 302 to the content host with `no-store`, `no-referrer`, `noindex` and no cookie, and repeating them never gives a cache `HIT`. A decorated entry (`?utm_source=…`) redirects to the bare content URL. The content root 302s to `index.html`, uncached. The document is served with the sandbox CSP, `no-store`, `noindex` and no cookie, and its subresources come back `cf-cache-status: BYPASS`. Opened through the entry URL and through the direct content URL, the stranger's, B's and A's own browsers all render the CSS, script, image and relative `sub/` page with its `../` asset. B's own public view is served beside it, a second export of A stays private on its own address, and changing the duration keeps both URLs. | pass |
| Blocked cookies | A recipient that sends and stores no cookies reads the whole export through the entry URL. | pass |
| Restart | After `systemctl restart open-habitat-gateway`, the public entry still redirects, the private one stays private, and the owner's list is unchanged. | pass |
| Owner makes private | The entry no longer redirects and the content URL answers 404. The owner still opens it privately through the same entry. | pass |
| Republish | Both earlier URLs come back unchanged. | pass |
| Expiry | Simulated: `public_until` was moved into the past in `view-links.json` with the gateway stopped. The entry gives the app page, the content URL answers 404, and the reservation remains in the owner's list as expired. Republishing brings the same entry back for 30 days. | pass |
| Site toggle | Simulated by setting `view_link_max_days` to 0 and restarting the gateway. The entry gives the app page and the content URL 404. The owner can still list addresses, a publish is refused with 409 `view_sharing_off`, and a private address still opens in the owner frame. Turning sharing back on brings the unexpired publication back. The configuration bytes were restored exactly (same SHA-256). | pass |
| Owner deletion | Both URLs end, and the entry no longer resolves even for its owner. Reserving the same view again gives fresh, private secrets. | pass |
| Administrator revocation | Root made B an administrator with `admin role update`. B's publication list shows metadata only: no entry, no token, and none of A's private reservations. B's delete ends both of A's URLs and removes the reservation from A's list. A's next reservation for that view is fresh and private, and the old URL stays dead. | pass |
| Root subject revocation | `open-habitat revoke subject <A>`: the entry gives the app page, the content URL 404, A's session 401, and the store holds no address of A. | pass |
| Withdrawal | `admin access remove --github-id <B>`, which is the administrator's withdrawal path: B's public entry stops redirecting, the content URL answers 404, B's session 401, and the store holds no address of B. | pass |
| Logs | No entry or content secret from either run (20 secrets checked) appears in the guest's whole journal since the run started (2066 lines), in Alder's `cloudflared` journal, which writes no per-request lines at its current level, or in the `omega-forward` journal. The guest journal holds no `/n/` path and no `return_to`. | pass |

The first run, with alice and bob, failed four checks, all because of harness
mistakes. It expected the content root to answer 200, but it correctly 302s to
the entry file. Its cookie-stripping route followed redirects itself, so the
page stayed on the app origin. Every product-side check in that run, including
both revocations, passed. The fixed harness ran again on fresh accounts.

## Environment gaps (not proven here)

- **Real GitHub sign-in:** sessions were minted, so the OAuth callback and
  the return to the private entry after sign-in were not run live. Only the
  provider-facing half was checked: no secret in the URL or `Referer`. The
  gateway's return handling is covered by its route tests.
- **Third-party cookie blocking:** on this server it proves nothing. The app
  and the view namespace share the registrable domain `example.test`, so the
  owner frame's cookie is first-party whatever the flag says. The operator
  guide already requires a same-site view namespace.
- **Safari, WebKit and Firefox:** not exercised. Only Chromium was available.
- **`oauth.access` exemption:** the pin is not installed on the test server.
  The exemption stays proven only by the gateway's router test.
- **Cloudflare's own logs and analytics:** they are outside what can be
  inspected here. Cloudflare sees every URL. The operator guide now says to
  keep entry, sign-in-start and view-namespace paths out of logs, analytics
  and cache rules.
- **Expiry and the site toggle** were driven through state and
  configuration, not by waiting a day or by `host apply`.
- **Restoring admission after withdrawal** was not tested: a synthetic
  subject fails the GitHub lookup that `admin access add` performs.
- **File-offer addresses, missing exports, traffic budgets and reservation
  caps** were not exercised live. The gateway tests cover them.

## Side effects and the state left on the test server

- The synthetic accounts are withdrawn, their daemon and agent sockets are
  stopped, and they have no sessions or addresses. The broker has no account
  deletion, so their Unix users stay inert. The real people's six sessions and
  Jari's four addresses are unchanged, and the temporary root backups were
  removed.
- **Finding:** withdrawing a person leaves their sockets active, and
  Fleetrepo's test-guest JIT gate then refused every later socket start,
  including the next first login. Fixing it took a manual stop. Filed through
  intake as `withdrawal-sockets-block-jit-gate`. Whether the product should
  stop the listeners on withdrawal, or the gate should tolerate them, is an
  open product-versus-installation choice.
- **Alder egress repair:** at the start the test VM was unreachable. Alder's
  egress had moved to `198.51.100.210`, and the repair refused to run because
  Alder's Fleetrepo checkout held two committed, unpushed commits
  (`open-habitat-upgrade` skill fixes). Following the repair's runbook, they
  were rebased onto `origin/main` and pushed, and the repair then added the
  new source.

## Checks

- Live harness: 61/61 (final run), described above.
- `python3 scripts/validate-project-view.py`: 14 pages and 14 navigation
  entries.
- `git diff --check` and `issuectl doctor --json`.
- No Go or web test ran, because no product code changed. No independent
  `/llm-review` ran either: the brief requires one for a product diff, and
  this unit's diff is documentation, instructions and evidence only. The new
  `internal/AGENTS.md` rules and the operator paragraph were checked by hand
  against `view_links_linux.go`, `diagnostic/request.go` and the live
  responses.

## Decisions for later review

- **Minted sessions for synthetic accounts, not real people's accounts.**
  The alternatives were Jari's, Ville's or Kaisa's real test accounts
  (other people's homes and sessions) or a local synthetic host (no real
  ingress). Accounts created through the real broker, with root-written
  session records, test everything after OAuth through the real path.
- **ADR 0033 removed together with ADR 0035.** ADR 0035 amended 0033's
  address, lifecycle and movable-link rules. No open issue named 0033, and
  its remaining rules (anyone with the link, the operator's switch, no agent
  link operation, administrator deletion) are carried by the code,
  `internal/AGENTS.md` and the operator guide. Keeping it would leave a
  record describing movable links that no longer exist.
- **Synthetic accounts left withdrawn rather than deleted.** No product path
  deletes a bound account, and removing the users by hand would make the
  broker state drift from NSS.
