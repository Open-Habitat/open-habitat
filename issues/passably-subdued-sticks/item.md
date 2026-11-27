---
created: 2026-11-27
updated: 2026-11-27
type: feature
status: open
priority: normal
provenance: other
provenance_detail: 'GitHub issue #2'
source_ref: https://github.com/Open-Habitat/open-habitat/issues/2
lane: unlaned
preparation: pending
---

# Microsoft 365: allow integrations with several Entra tenants on one server

## Description

Microsoft 365: allow integrations with several Entra tenants on one server
https://github.com/Open-Habitat/open-habitat/issues/2

Microsoft 365 is configured for one Entra tenant per server: one single-tenant public client (per level) and one `tenant_id` (docs/operations.md, "Microsoft 365"). Accounts from any other tenant are refused with "Not in the server's organisation". Google, by contrast, accepts any account through one External app, so a person can connect several Google accounts.

This blocks a common use: a consultant or small firm whose people work for several client organisations, each on its own Microsoft 365. Today the server can serve only one of those clients, and connecting the firm's own tenant would take the slot.

Observed case: a person has guest access (B2B) to a client's SharePoint site. To let their agent read it, the client's administrator would have to register the application in the client tenant, and the whole server's Microsoft integration would then be bound to that client.

Wish: Microsoft 365 integrations for several tenants on one server, as with Google accounts. Possible directions:
- Several tenant configurations side by side (client id + tenant id each), with the person choosing the organisation when connecting; or
- A multi-tenant ("Accounts in any organizational directory") registration in the operator's own tenant, with sign-in against the target tenant's authority, so that a guest account signs in to the tenant where it is a guest, and each client tenant's administrator consents once.

Either way, a B2B guest account should be able to connect against the tenant where it is a guest, not only its home tenant.

Workaround used meanwhile: an agent-driven headless browser signed in as the person, which is more fragile than the integration.

## Decisions

### 2026-11-27T07:52:39Z · @jari

Jari 27.11.2026: research first (the two directions, their security, consent and operating consequences); the architecture decision follows from the research.

### 2026-11-27T08:11:45Z · @jari

Jari 27.11.2026: direction B. The server operator creates the multi-tenant applications once in their own (parent) tenant; each client organisation's administrator approves them in their tenant; the operator allows those tenants on the server. Existing single-tenant connections keep working. Conductor defaults (Jari may revisit): the operator's organisation is the publisher, publisher verification optional (unverified warning accepted at first); first case to prove is one person connecting their own organisation plus two client SharePoints as a guest. Next action (approved): a design (admin and person flows, connection identity per tenant+user, migration) for Jari's approval before implementation.

### 2026-11-27T09:45:22Z · @jari

Jari 27.11.2026: the design's three recommendations accepted (no who-connected list in v1; removing an organisation only stops connections; fetched files keep ~/cloud/microsoft-fetched/<address>/). UI first: a prototype round of the UI parts before any implementation, to see what it looks like. Next action (approved): prototype round 1.
