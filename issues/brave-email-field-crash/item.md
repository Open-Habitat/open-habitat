---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
preparation: ready
lane: unlaned
collision: [web/src/components/Integrations]
closed: 2026-10-24
---

# Brave crashes while typing the email in the CardDAV (and IMAP) connect form

## Description

Jari, 2026-10-24 (test server, Brave on macOS): in Settings › Integraatiot › Yhteystiedot (CardDAV) connect form, **typing the email address crashes the whole browser**. "Tämä sama ongelma oli joskus jossain toisessakin kentässä, olisiko ollut IMAP-sähköpostin lisäämisessä." The earlier report `brave-imap-crash` (2026-10-20) could not be reproduced in Linux Chromium (its result is in git history: `scripts/from-history.sh issues/brave-imap-crash/result.md`); the IMAP and DAV connect forms share code in `web/src/components/Integrations.tsx` / `web/src/app/IntegrationsSettings.tsx`, and other email fields (`GitIdentity`, `AccountProfileOnboarding`) have not been reported.

Find what the integration email fields do differently on every keystroke (derived username/server, discovery requests, autocomplete/autofill attributes, input type, re-mounts, password-manager heuristics) and the actual crash cause. A browser-process crash triggered by page content usually points at autofill/password-manager or a native integration; get evidence rather than guessing.

## Acceptance Criteria

- [x] Cause with evidence (crash report signature, or a reproduction in Brave/Chromium), in result.md.
- [x] Fix so typing the email in the IMAP, CalDAV and CardDAV forms does not crash Brave; regression test for the triggering behaviour.
- [x] KOKEILTAVAA.md line for Jari to retry in Brave.
