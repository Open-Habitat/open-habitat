# Result: unified publication checks for stable view addresses

Landed in the same code change as `view-address-reservations` (see its
result for the store and the transition).

## What landed

- Publication is state on the reservation: `POST /api/v1/view-addresses/publish`
  (days from now, from private, expired or public; the export is verified
  through the owner's daemon and the session rechecked), `/duration` (only for
  a current publication, `view_address_not_public` otherwise, never publishes),
  `/private` and `/delete` (permanent; a later reservation of the view gets
  fresh secrets and starts private). Secrets never change; republishing
  revives earlier copies. Active publications keep their own caps (50 per
  person, 4096 per site).
- Removed: `/api/v1/view-links*` (create, change with re-point and new
  address, revoke), multiple links per view, and the Settings/dialog callers
  of re-point and *Uusi osoite*.
- Content authorization on every request: publication and expiry, the site
  switch (`link_max_days` 0 pauses; restoring resumes unexpired
  publications), owner denial, store usability. Direct old content URLs follow
  the same state. Traffic budgets unchanged (per address and site).
- Administrator: `GET /api/v1/server/view-publications` lists only current
  publications' metadata (no URL, secret or private reservation);
  `/delete` deletes an address for good. Root revocation and withdrawal delete
  the person's addresses.
- Web: `viewLinks.ts` is the address store (reply validation now requires the
  entry URL on the app's own host and the content URL elsewhere); the old
  share dialog ensures and publishes, extends with duration and stops sharing
  with private; Settings lists current publications (copy, stop); the
  administrator's row deletes. A publication paused by the site does not show
  as shared on the card.

## Tests

Gateway: anonymous read of one export, private/expired/republished/deleted
addresses, duration on a non-public address, ownership and request shape,
missing export never published, site switch, denial and revocation, admin
list secrecy and delete, caps and budgets, session-ended writes. Web unit
tests for the store and ViewHost; browser `view-links.spec.ts` (share, stop,
reshare revives the same link, Settings, administrator delete).

## Decisions for later review

- **Two URLs in the reply.** The reply carries `url` (stable entry on the app
  origin, the address the ADR opens and copies) and `content_url`. Until
  `view-address-entry-route` serves `/n/`, the old dialog and Settings copy
  `content_url`, so `main` keeps working links; unit 4 switches to `url`.
- **Separate endpoints** for publish, duration, private and delete instead of
  one change endpoint, so a duration change racing with expiry can never
  publish.
- **Settings shows only current publications** with copy and *Lopeta*
  (make private), as the old row did; the full inventory with permanent
  deletion is unit 4's. Until then deletion is reachable through the API and
  the administrator only.
- **Dialog wording** now says sharing again revives the same link, because
  the old "removing the link" promise is no longer true.
