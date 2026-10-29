# ADR 0033: Anyone with the link can open a shared view

**Status:** Accepted. **Date:** 2026-10-29. **Decider:** Jari decided the goal
on 2026-10-29 (`research-ville-feedback`, item 4): anyone who has the link can
open a shared view. He accepted the model the same day
(`decide-view-link-sharing`) and dropped the anti-phishing measures of the
proposal: shared content runs like the person's own view, with no script-free
frame page that blocks navigation and no separate public domain. This record
amends ADR 0032 decision 5, which kept views owner-only and public links off.
The implementation is `view-link-sharing`.

## Context

Ville builds an interactive cash-flow page with his agent and wants Olli and
others to open it. Today a view (ADR 0032) is a frozen export in the owner's
`~/.local/state/open-habitat/views/`. The gateway serves it on a per-view host
after a one-time handoff from the owner's signed-in app. Every response carries
a sandbox CSP (scripts but an opaque origin, no network, forms, popups, workers
or top navigation), and the owner's daemon returns only that export's files on
its fixed export-read route. No one but the owner can open it.

A link that anyone can open is an anonymous bearer capability. Whoever holds
the URL reads the content. It is not named sharing without a login. The research
behind ADR 0032 (`issues/agent-html-artifacts/research.md` §6, in history) set
the conditions for it: off by default, enabled by operator policy plus an
explicit owner action on a specific frozen export, expiring and revocable, no
indexing, and no cache that outlives revocation. This decision keeps those
conditions.

The view host's cookie cannot carry an anonymous link: a browser that blocks
third-party cookies drops even the view's own host-only cookie from a
top-level sandboxed document, which is why the app always frames a view
(`internal/gateway/views_linux.go`). A link is opened top-level with no app
around it, so the capability is in the URL of every request.

## Decision

1. **A link is a gateway-held capability to one frozen view.** The gateway
   keeps the link record in its private state, beside its session store:
   link ID, owner route (as a session holds it), view ID, the view's title,
   created, expires, and the token, 256 random bits. Nothing new is written
   in the owner's home, the export or the broker. The token is never logged.

2. **Only the person, in the browser, creates, changes and revokes links.**
   The view card and the panel header gain *Jaa linkillä*. The dialog shows
   what will be shared (title, file count, size), the expiry, and what a link
   means: anyone who has it can open it, and revoking it does not recall what
   has already been opened or copied. Creation is an app-origin write with the
   existing session and CSRF checks, and the gateway first confirms through the
   owner's daemon that the view exists. The same dialog, and a list in the
   account settings, let the person copy the link again, extend it, point it
   at another of their views, give it a new address, or revoke it.

   **The agent gets no link operation.** The agent listener (ADR 0027) gains
   nothing. The agent cannot create, list, extend, point or revoke a link, or
   learn its URL, so a prompt-injected agent cannot publish anything. The
   agent's view skill tells it to point the person to *Jaa linkillä*. If the
   person pastes the URL into the conversation, the agent may use it like any
   other text.

3. **A link shows a frozen view and follows updates only when the person says
   so.** It serves the export it names. A new version from the agent is a new
   view and does not change the link. With *Vaihda sisältö* the person points
   an existing link at another view of their own and the URL stays the same,
   which is the "follows updates" case done as a human act. Deleting the view
   (the agent's `view remove` included) leaves the link answering "no longer
   available"; it never falls through to another view.

4. **Content is served from the owner's daemon, never copied out of the
   home.** A link read goes through the existing fixed export-read route
   (`/view-export/<id>/<path>`) on the owner's verified daemon socket, the
   same route the owner's own view uses. The daemon gets no new route and no
   identity claim, and it decides what bytes the view holds. If the daemon is
   unavailable, the link is unavailable. The gateway keeps no content cache.

5. **A link runs like the person's own view, on a host of the view
   namespace.** The link is `https://<link host>/<token>/`, where the link
   host is the installation's view template (`views.origin_template`) with a
   label derived from the link ID, so a link needs no new DNS name or
   certificate and each link has its own origin. The token is the first path
   segment of every request, compared in constant time with the record named
   by the host, and expiry, revocation and the owner's withdrawal are checked
   on every read. The root redirects to the export's entry under the token, so
   relative URLs resolve. Responses carry today's view CSP and headers
   (sandboxed opaque origin, scripts without network, forms, popups or
   workers); the page is opened top-level and may navigate itself, like the
   owner's own view opened outside the app. A link host sets no cookie and
   reads none, has no handoff, API or state-changing route, and serves nothing
   but its one link. The token is not part of the hostname, because hostnames
   leak through DNS resolvers, passive-DNS datasets and TLS SNI.

6. **The operator decides per site, and it is off by default.** In
   `site.json`, `views.link_max_days` (1–365 days, published by host apply as
   the gateway's `oauth.view_link_max_days`) enables links and sets their
   longest expiry. Without it the browser shows no *Jaa linkillä*, the gateway
   refuses link operations, and link hosts serve nothing. Removing it stops
   serving every existing link; restoring it brings them back until they
   expire. The view namespace must reach the gateway without an access
   policy or edge cache in front of it for anyone to open a link; where an
   ingress or the gateway's Access pin guards it, "anyone" means anyone past
   that gate, as on a tailnet-only installation such as Birch.

7. **Expiry, revocation and limits.** The owner chooses 1, 7 or 30 days
   (default 30) or the operator's maximum, and can extend a link from the day
   of the extension. Revoking a link removes its record, and the next request
   fails. *Uusi osoite* replaces the token, and the link host with it, and
   keeps the content. When a subject is revoked or withdrawn
   (`RevokeSubject`, access withdrawal), their links are removed with their
   sessions, and a denied subject's links answer nothing meanwhile. The site
   administrator can list link metadata (owner, title, created, expires, never
   the URL) and revoke any link, which is the abuse response. Size is already
   bounded by the export (500 files, 50 MiB). The gateway adds a per-person
   cap on active links, a per-link and per-site daily byte budget, and a cap
   on concurrent public relays, so public traffic cannot starve owner traffic
   or exhaust a daemon. Counters live in memory, and a restart resets them.
   The numbers are implementation tuning.

8. **Public responses carry no tracking and allow no indexing.** Responses
   carry `Referrer-Policy: no-referrer`,
   `X-Robots-Tag: noindex, nofollow, noarchive`, a `robots.txt` that disallows
   everything, `Cache-Control: no-store`, `nosniff` and today's
   Permissions-Policy. There is no directory listing, no analytics and no
   third-party resource. The gateway logs link ID and outcome, never the token
   or the path. Recipients are not identified or counted per person.

Named sharing to signed-in people on the same server stays deferred. A link
covers the Olli case, and nothing in this design blocks adding it later.

## Authority

| Who | Gains | Does not gain |
|---|---|---|
| Person (app session) | Create, extend, re-point, re-address and revoke links to their own views | Links to anyone else's view |
| Gateway | A persistent link store; serving an owner's export to a request **with no authenticated person**, by bearer token | Any new daemon route; a content copy or cache; any identity it passes to the daemon |
| Owner daemon | Nothing (same export-read route) | Knowledge of who reads |
| Agent | Nothing | Any link operation or link URL |
| Site administrator | Revoke any link; see link metadata | The link URL |
| Operator | `views.link_max_days` | — |
| Provision broker | Nothing | — |

The architecture change Jari approved is in the second row. Until now the
gateway read a person's daemon only for that person's own session. With this
change it also reads one explicitly linked export for an anonymous request.
What leaves the home is unchanged: the bytes of one frozen export, through the
owner's daemon, only while a valid link names it.

## Threat model

- **Link leakage.** Links get forwarded, synced in browser history, pasted into
  chats, fetched by link unfurlers and email scanners, and seen by a
  TLS-terminating ingress such as Cloudflare. The defences are expiry,
  revocation, a new address, `no-referrer`, keeping the token out of the
  hostname and the gateway's logs, and stating in the dialog that the link is
  the key. A recipient can always copy what they saw, and no setting changes
  that.
- **Indexing and discovery.** The token space is not guessable, nothing lists
  links, and responses carry `noindex` and `robots.txt`. `noindex` does not
  make content confidential. Only the secrecy of the link does.
- **Phishing on the product's domain.** Shared content can show a fake form
  and navigate itself away with what was typed. Jari judged this risk
  hypothetical and not worth measures that spoil the content (2026-10-29); the
  administrator's revocation is the response to an abusive link.
- **Malicious content against the recipient.** The recipient's browser
  sandbox applies: an opaque origin, no downloads, popups or permissions, no
  network. It cannot reach the app (no cookie on a link host, an opaque
  origin, exact Origin checks on app writes), other links (each request is
  authorized by its own token, and content cannot fetch), or the owner's
  other files (the daemon serves only that export).
- **A compromised or prompt-injected owner agent.** It cannot create, extend
  or re-point links. It can remove a linked view, or rewrite the files of a
  linked export in place, because exports are not protected from their own
  UID. The rewritten content stays under the same confinement. Freezing a
  copy outside the home would close this gap, but at the cost in decision 4;
  the gap is accepted.
- **Abuse of the installation.** Exports are already size-bounded, and the
  gateway adds byte budgets, a concurrency cap and per-person link caps. A
  daemon that is down yields "unavailable", not a stale copy.
- **Gateway compromise or state leak.** A compromised gateway can already read
  every export through every daemon, so the link store adds nothing there. A
  leaked copy of the gateway's state would expose live link tokens, because
  they are kept so the person can copy a link again. Hashing them like
  sessions would remove that copy feature. The state is gateway-private, and
  that trade-off is accepted.

## Alternatives rejected

- **Copy the export to a public serving area.** This would protect the content
  from in-place rewrites and keep public traffic away from the daemon. It
  would also create a second content store outside the home and its quota,
  give the gateway write authority over content, and add a copy that must be
  deleted on revocation and deprovision. It runs against "no parallel store".
- **Keep link records in the owner's home and let the daemon check the
  token.** No gateway state would be needed, but any same-UID agent could then
  publish without the person.
- **Make the token the hostname.** Root-relative links would keep working, but
  hostnames leak through DNS, passive-DNS datasets and SNI.
- **A script-free frame page on a separate public host** (the proposal). It
  kept typed text from leaving, but stopped shared content from behaving like
  the person's own view and needed one more DNS name, certificate and ingress
  rule. Jari dropped it with the separate-domain recommendation.
- **External publishing (S3 presigned links, Pages).** This stays an
  operator's or organization's own choice, and the product gets no part of it.

## Consequences

- ADR 0032 decision 5 is narrowed: views remain owner-only unless the person
  creates a link on a site whose operator enabled them. Decisions 1–4 and 6
  stand. Live dev servers are never linked.
- No new DNS name or certificate: links live in the view namespace the
  installation already routes.
- The gateway gets a new persistent state file and an administrator view of
  link metadata.
- Root-relative URLs inside a view (`/style.css`) do not resolve under a link,
  because the token is the first path segment. Relative URLs do. The agent's
  view skill already asks for relative links.
- The documentation (`docs/operations.md` views section) changes its "no
  sharing or public link" sentence once the implementation lands.
