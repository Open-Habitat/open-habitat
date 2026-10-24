---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
preparation: ready
lane: unlaned
collision: [internal/daemon/integrations]
---

# Connected Dropbox shows 'Tilaa ei saatu selville'

## Description

Jari, 2026-10-24 10:53 (test server, screenshot): Asetukset › Integraatiot, his connected Dropbox account card shows the folder `~/cloud/dropbox/maintainer@example.org` and **"⚠ Tilaa ei saatu selville · Tarkistettu klo 10.53"** (service status `unknown`, `web/src/components/Integrations.tsx`). A connected Dropbox should report its real state (synced / not mounted / sign-in expired …) or a concrete reason.

Find the live cause from evidence on the disposable test server: the daemon's Dropbox status check (`internal/daemon/integrations/dropbox_linux.go`), the rclone mount/unit for the mapped user `maintainer`, and the daemon/gateway journal around 10.53. Never read the person's file contents or conversation content; metadata, unit state and logs only. Note the test server's tools come from Fleetrepo and the product now ships its own pinned rclone (`integration-tools-always-installed`): check whether a path/version mismatch is the cause.

## Acceptance Criteria

- [ ] Named live cause with evidence in result.md.
- [ ] Fix so a healthy connection shows its state and a failing one shows a concrete reason; test reproducing the cause.
