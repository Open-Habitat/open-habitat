---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
preparation: ready
lane: unlaned
collision: [internal/daemon/integrations]
closed: 2026-10-24
---

# CardDAV/CalDAV: iCloud (and redirecting providers) cannot be connected

## Description

Jari, 2026-10-24: connecting iCloud contacts via Asetukset › Integraatiot › Yhteystiedot (CardDAV) with DAV address `https://contacts.icloud.com`, Apple ID and an app-specific password fails with "DAV-osoite ei vastannut suoraan. Anna palveluntarjoajan lopullinen CalDAV- tai CardDAV-osoite, ei .well-known-osoitetta. Mitään ei tallennettu."

iCloud serves each account from a partition host (`pNN-contacts.icloud.com`, `pNN-caldav.icloud.com`) found through redirects / current-user-principal; a person cannot know it. The integration deliberately refuses redirects and follows DAV hrefs only on the configured server (`internal/daemon/integrations/dav_linux.go`).

Goal: iCloud contacts and calendars connect with the address a person can know (`https://contacts.icloud.com`, `https://caldav.icloud.com`). At connect time, discover the final host safely (one bounded discovery with the same credentials: follow the redirect or principal href only to a host under the same registrable domain as the entered one, HTTPS only, same credentials never sent elsewhere), store the discovered final base URL as the account's server, and keep the strict no-redirect rule for the agent's later requests. Also consider other well-known providers that redirect similarly (Fastmail, Nextcloud `.well-known`) under the same rule. The form text can then drop the "lopullinen osoite / ei .well-known" instruction, or shorten it.

## Acceptance Criteria

- [ ] Connect with `https://contacts.icloud.com` succeeds against a fake server that mimics iCloud's redirect/principal flow; a redirect to another registrable domain is refused (tests).
- [ ] The agent's skill text and curl config use the discovered host; no redirect following at use time (test).
- [ ] KOKEILTAVAA.md line for Jari to retry iCloud. Review: independent `/llm-review` (credential scope, network boundary).
