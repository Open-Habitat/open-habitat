---
created: 2026-10-20
updated: 2026-10-20
type: improvement
reporter: jari
status: done
priority: normal
lane: web-chrome
lane_seq: 2
collision: [web/src/app/settings]
closed: 2026-10-20
---

# Settings sections need their own URLs

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: settings subpages (Tili, Agentit, Yhteydet, Integraatiot, Ulkoasu, Tallennustila, Palvelin, Käyttäjät, Levytila) should have their own URLs so they can be linked, reloaded and navigated with back/forward. Admin sections stay forbidden for non-admins by URL too.

## Acceptance Criteria

- [x] Every settings section has a canonical, linkable URL, including integrations and devices.
- [x] Reload and browser back/forward restore the selected section; mobile list/detail navigation uses URLs.
- [x] Canonical signed-out deep links survive OAuth login; unknown settings paths retain a safe sign-in fallback.
- [x] Non-admin direct admin URLs cannot display admin controls; host administration APIs still return 403.
- [x] Required focused evidence and independent review are complete; broader pre-existing failures are reproduced on unchanged main.

## Result

See [implementation and validation result](result.md), including the unchanged-main failure comparison, review fixes, deferred captures and full attempt inventory.
