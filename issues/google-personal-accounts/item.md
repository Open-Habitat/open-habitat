---
created: 2026-11-16
updated: 2026-11-24
type: feature
reporter: jari
status: in-progress
priority: normal
provenance: chat
source_ref: chat:2026-11-16/google-personal-accounts
lane: google-personal
lane_seq: 1
preparation: pending
---

# Google integration for personal Gmail accounts: External consent screen, admin and person flows

## Description

Jari 16.11.2026: people must be able to connect their own personal Gmail (@gmail.com) accounts easily. Today the server's Google setup guide configures the consent screen as Internal (Google Workspace only), so personal accounts cannot connect at all (docs/operations.md, web/src/components/ServerIntegrations.tsx).

Decided by Jari:
- The staging installation and one pilot installation switch their Google projects to External (published, unverified), accepting Google's 'unverified app' warning and the user cap.
- The user interfaces for taking this into use must be designed, both the administrator side (server integration setup guide: choosing organisation-only vs also personal accounts, publishing, consequences) and the person's side (connecting a personal account, explaining Google's unverified-app warning and how to pass it).

Next actions: (1) research: verify Google's current rules for an External, in-production, unverified OAuth app with restricted scopes (gmail.modify, drive) and sensitive scopes (calendar, contacts): user cap, warning screen and its wording, refresh-token lifetime, Workspace admins blocking unverified apps and how they trust one, what changes when switching Internal→External for existing connections, and whether narrower scopes would avoid restricted-scope limits. (2) two prototype rounds, one per view: admin setup guide and person's connect flow.

Alternative considered: Gmail via IMAP app password (mail only); a centrally verified Open Habitat client (CASA assessment yearly) — not chosen now.

## Comments

### 2026-11-18T14:12:39Z · @jari

Jari 18.11.2026: the External switch was tried on the pilot installation (not the staging one) and it worked.

### 2026-11-24T16:31:06Z · @jari

Jari 24.11.2026: a person on another installation could not connect a second personal Gmail account: Google refused with "403 org_internal" (the installation's Google app is Internal). Jari wants this External matter put right as a series of user interfaces: first the administrator side, then the person's side. Conductor: the admin guide and person flow from 21.11. are already shipped (v0.1.5+); next is to show Jari what they look like today, including the Internal/org_internal case, and prototype what is missing.

## Decisions

### 2026-11-21T07:14:11Z · @jari

Jari 21.11.2026: Admin guide: A Kysymys ensin; Habitat does not remember the audience choice; keep the warning illustration; audience change as its own row menu item; (privacy-policy URL not required, recommendation). Person's flow: A Muistutus, short and even more concise; 'you stopped at Google' on cancel: yes; the connected dialog lists granted services: yes; admin app-name field: not now. Screenshots: yes — the way the Microsoft dialog shows screenshots in complex integrations is good, and simple ones may have them too, especially where the person must click an option that is not the default (Google's Advanced → Go to …). Next action: implement both views with screenshots.
