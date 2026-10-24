---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
preparation: ready
lane: unlaned
collision: [web/src/app/Settings]
---

# Integraatiot admin rows overlap; access list shows GitHub id instead of username

## Description

Jari, 2026-10-24, testing on 0.0.0-pilot.379:

1. **Asetukset › Palvelimen ylläpito › Integraatiot**: the service name and the status overlap ("Google✓Käytössä" drawn over the name; "Microsoft 365", "Sähköposti (IMAP)" etc. wrap and collide with "✓ Käytössä"). Layout the row so name and status never overlap at any width (desktop and 390 px), names do not wrap unnecessarily, light and dark.
2. **Asetukset › Käyttäjät ja pääsy**: a row reads "GitHub-id 1272053"; it should show the GitHub username (login). Show the login as the primary identifier; the numeric id only where it disambiguates (e.g. a detail/tooltip), never as the label. If the gateway's access list lacks a current login for some rows, fetch/keep it the way `site-access-tab` already looks logins up, and record the choice in result.md.

## Acceptance Criteria

- [ ] Both fixed with stories and a browser check at 1366 and 390 (no overlap: assert bounding boxes); access list shows logins.
- [ ] KOKEILTAVAA.md line.
