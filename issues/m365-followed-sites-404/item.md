---
created: 2026-11-10
updated: 2026-11-10
type: bug
status: open
priority: normal
related: ['@microsoft-first-sync-over-quota-and-channel-site-skip', '@m365-teams-files-and-messages']
preparation: ready
lane: m365-followed-sites
lane_seq: 1
---

# Microsoft 365: every followed SharePoint site fails discovery with 404 itemNotFound

## Description

Contoso pilot, 10.11.2026: Aino reports he still does not see his SharePoint
files. Read-only check on the server:

- His Microsoft sign-in (6.11.) succeeded, and his file sync contains **only
  his OneDrive** (one rclone remote, `drive_type = business`, bisync passes
  running every minute). No SharePoint library was ever added.
- Discovery logged `integration_discovery outcome=skipped
  reason=site_unavailable step=site_drives http_status=404
  graph_code=itemNotFound` **twice**: both sites he follows failed at
  `GET /v1.0/sites/{id}/drives` with the id taken verbatim from
  `/me/followedSites` (`internal/daemon/integrations/microsoft_files_linux.go`).
- Anna's sign-in today failed the same way on the one followed site she
  had. The earlier analysis guessed a partner-hosted shared channel site for
  hers. With three of three followed sites failing for two people in the same
  tenant, a Habitat-side cause is now more likely than a tenant one.

Teams libraries arrive in pilot.26 (`m365-teams-files-and-messages`), but
only after the tenant consents to the two new permissions, and they do not
cover sites a person follows outside a team.
