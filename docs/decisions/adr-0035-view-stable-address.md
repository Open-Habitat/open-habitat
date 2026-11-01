# ADR 0035: One stable entry address per view

**Status:** Proposed for Jari's review. **Date:** 2026-11-01.
**Decision issue:** `decide-view-stable-address`.
Amends ADR 0033's address, lifecycle and movable-link rules; not yet authority
for implementation.

## Context and accepted direction

Today an owner's tab and a shared link use different addresses. The research
in `issues/research-view-stable-address/report.md` shows that a stable address
needs a gateway lifecycle change, not a new daemon or publishing service.

Jari chose option 2 on 1 November: *Avaa omalle välilehdelle* opens the same
address before and after publication, and *Kopioi linkki* copies that address.
The link belongs to the view, not its conversation card. He accepts that an
address seen while private becomes usable when published, and that publishing
again revives earlier copies. The recommendations below implement that direction;
the remaining choices, including the upgrade reset, await his approval.

## Three choices

### 1. Stable entry address, or stable address bar?

**Recommend a stable entry address**, `https://<app>/n/<random-secret>`.
Privately it opens the existing product-owned frame after owner sign-in;
publicly it redirects to the existing cookie-free content host. Opening and
copying always use the entry address, but the public browser's address bar
changes after the redirect. A bookmark of that final content address also
works during subsequent public periods; it never grants private access.
To avoid popup blocking, an unknown address opens the owner-only `/view?id=…`
launcher synchronously; that page ensures the reservation with a CSRF-protected
POST and replaces itself with the entry address. GET and card rendering never
create reservations.

Keeping the address bar unchanged would require framing public content too,
changing the navigation behaviour Jari accepted, or a new authentication
arrangement on the content host. Neither earns its additional browser and
security work merely to hide the redirect. This distinction needs Jari's
explicit approval: we are not promising an unchanged address bar.

### 2. Revive old copies, or rotate on publication?

**Recommend revival, as Jari directed.** Publication, expiry and making private
do not change either secret. Expiry ends anonymous access, not the reservation.
Republishing is an explicit browser write, starting from `min(30, max_days)`
days again. Changing duration can shorten or extend the current public period;
it does not publish a private view. There is no automatic renewal.

Rotation would invalidate previous recipients and defeat the stable-address
promise. Remove *Uusi osoite* rather than imply that internal-token rotation
can invalidate a stable entry URL. An explicit owner action in Settings may
**delete the address permanently**, ending both entry and content access. A
later reservation gets fresh secrets, never reuses the deleted address, and
starts private. This is a deliberate escape from permanence, not ordinary
owner unpublishing. Recommend that administrator revocation, root subject
revocation and access withdrawal also permanently delete reservations, preserving
the abuse response: old recipients' URLs stay dead even if an admitted owner
publishes a fresh address. Restoring admission does not republish. Site-wide disable remains a policy
pause: re-enabling permits still-unexpired publications again, as in ADR 0033.

### 3. A frozen view's address, or a movable publication's address?

**Recommend one reservation per authenticated owner and frozen view ID.**
The gateway creates it lazily when the browser first needs it, with a
CSRF-protected, concurrency-safe ensure operation. Repeated offers of that same
ID use the same address and current publication/expiry on every card. Card
history never freezes publication state; mounted cards share one owner-scoped
state, refresh on re-entry/focus and at expiry, and discard it on account change.
An unavailable refresh is unknown, not private or public success.

A newly exported version is a **new private view with its own address**.
Neither equal source paths, equal bytes/titles nor an agent's “replacement”
flag transfers publication. Paths get reused and an agent must not decide
which new export an existing audience sees. A person's explicit replacement
could safely authorize that transfer, but would introduce a logical document
identity distinct from the frozen view. Do not add it in this change: the
person publishes the new view and shares its new address. Remove *Vaihda
sisältö* and multiple links per view from both API and Settings. This loses
intentional rolling publications in exchange for an address with one clear
owner and target; Jari must approve that trade-off.

## State and security consequences

Extend the gateway's existing private link store, rather than add a second
registry: reservation ID, owner route, frozen view ID, independent random
256-bit entry and content secrets, and public-until state. Enforce uniqueness
atomically. Persist with the existing private atomic-write discipline; corrupt
or unreadable state disables address reads and writes without replacing the
file; unrelated app functionality remains available and operators get a fixed,
secret-free diagnostic. It never silently resets. Private reservations
survive restart and expiry. Separate bounded per-owner/site reservation caps
from active-publication caps; at the cap refuse new reservations with an
explicit delete-address remedy, never evict existing addresses, even ones never
published: private bookmarks are part of the promise too. Owner Settings must
list all their reservations, including private, expired and missing-export
ones, and allow deletion even when sharing is disabled. This deliberately means
that at capacity a new own-tab address needs manual cleanup. Missing exports
stay unavailable and are never retargeted; deletion of a reservation does not
delete the export or scan homes.

| Consequence | Answer and remaining limit |
|---|---|
| Old private copies and recipients gain access on publication | Accepted by Jari; randomness prevents guessing, not use of an already known URL. Private is a current state, not a promise that the address will never work. |
| App origin now resolves a bearer address | Serve only product UI or a redirect built from gateway state, never export HTML. Public opens, including the owner's, use public budgets. Private opens compare the session owner before handoff; the URL never chooses a session's Unix user. Anonymous and wrong-owner private/missing addresses reveal neither title nor owner. |
| Login return can leak the secret or become an open redirect | Retain the destination server-side through the existing login flow, not in the provider-facing URL; accept only a validated same-app entry path. Do not send the entry secret to the identity provider. |
| More secret-bearing request paths | Exclude secrets from app diagnostics, ingress logs and analytics. Apply `no-store`, `no-referrer`, `noindex` to entry success, redirects and errors as well as content. Include login-start query strings and referrers in that verification. No secret in DNS, no cached redirect, no directory listing. Verify the actual ingress, not just gateway tests. |
| A cached redirect or direct content URL bypasses entry checks | Check publication, expiry, site policy and owner denial on **every content request**, as well as entry resolution. Both URLs refer to the same durable publication state. Private owner sessions cannot authorize content-token requests. Revocation blocks new reads, not bytes already delivered or an admitted in-flight response. |
| A private reservation becomes an agent publishing interface | Only an owner app session with CSRF can reserve, publish, change duration or delete. Secrets remain gateway-private, not derived from view IDs or returned to agents. Verify export existence through the mapped daemon before reservation/publication and recheck the session before commit. |
| State and public traffic grow | Separate reservation and active-publication caps; retain per-link/site byte and concurrency budgets. Admin lists only publication metadata, never secrets or a new inventory of private views. |

## What stays as it is

The gateway authenticates and selects the Unix user; the daemon serves only its
own export files through the fixed export-read route; provision gains nothing.
No new service, content copy, home index, socket, DNS or certificate is needed.
Keep owner per-view origins, public per-link origins, sandbox CSP, opaque origin,
relative subresources and the owner handoff/frame. Agents still only offer or
remove frozen exports. A same-UID agent can still rewrite an export's files;
“frozen” is not protection against its owner. Anonymous ingress must reach both
the new entry route and content hosts without an upstream login gate. This adds
an explicit narrow public-resolution exception on the app origin, in gateway
Access handling and upstream ingress policy; it does not unprotect the whole
app. Private owner continuation retains the verified Access identity required
by its session, through a protected continuation when necessary.

Keep the accepted r2-B/r3-A card: one-press public switch, copy only while public,
clickable expiry with duration choices, and phone controls below the title.
No expiry notice, copy-recall warning or new confirmation dialog. Site policy
hides public controls when disabled but must not prevent private reservation
and opening. The panel's copy control is public-only too.

## Transition

Recommend an explicit **pre-release reset of old share links**, not a partial
conversion that silently chooses one of several links per view. The upgrade
must announce that all old URLs stop working, atomically install the new empty
format, and disable address reads/writes for an unconverted old format on ordinary
startup (without blocking the rest of the app). It must not
reset new-format state on subsequent upgrades or recover corrupt state as empty.
Exports and conversation offers remain untouched; old views acquire private
reservations lazily. No legacy movable-link API or anonymous alias survives.
This reset is part of the proposal awaiting Jari, not permission to do it now.

## Implementation units, in dependency order

All units await this ADR's approval. They are filed unlaned with preparation
pending under this run's intake policy; lane placement is a later human
scheduling decision. The existing card issue can keep its position 2: blocker
edges, not that position, make its prerequisites run first.

1. **Persist one bounded address reservation per view**
   (`view-address-reservations`). Extend the gateway store and contract with
   private/public state, unique lazy reservation, separate limits and explicit
   deletion. Implement owner/session checks and restart/corruption/concurrent
   ensure tests. Include the approved one-time legacy reset and upgrade notice;
   never grant public access merely by creating a reservation. Keep intermediate
   commits usable: every changed wire interface includes its generated types,
   client validator and affected callers in the same unit, not the later redesign.
2. **Unify publication checks for stable view addresses**
   (`view-address-publication-lifecycle`, after 1). Replace movable/multiple-link
   operations with publication and duration changes on the reservation. Wire
   content authorization, expiry, owner/admin revocation, withdrawal and site
   policy to that same state. Test direct old content URLs, republishing,
   deletion, unavailable exports and session races; retain traffic budgets.
   Remove obsolete Settings retarget/rotate callers with their API, and update
   URL validation when the response starts returning app-origin entry URLs.
3. **Open stable view addresses privately or publicly**
   (`view-address-entry-route`, after 2). Add the entry route and browser owner
   frame, bounded sign-in return and public redirect. Apply log/header secrecy
   and wrong-owner non-disclosure, with focused route and browser tests. Keep
   private opens usable with sharing disabled and preserve relative assets.
4. **View card: public switch, Kopioi linkki and duration menu**
   (existing `view-card-public-switch`, after 1–3). Implement the accepted card,
   common open/copy destination and owner-scoped multi-card state; finish Settings
   and panel controls, including the owner inventory and explicit permanent
   address deletion. Cover expiry, account switching, stale observations and
   uncertain writes by re-reading, never automatically repeating a mutation.
5. **Verify stable view addresses through the real ingress**
   (`view-address-end-to-end`, after 4). Exercise two users plus an anonymous
   browser, multi-file exports, blocked cookies, restart, expiry, republish,
   administrator/owner revocation, withdrawal, site toggle and deletion. Verify
   both URLs and ingress log/cache rules. Update the operator guide and record
   the approved authority rules in the nearest instructions. Report browser or
   environment gaps explicitly instead of claiming gateway tests prove them.
