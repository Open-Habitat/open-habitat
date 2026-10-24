---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: done
priority: normal
preparation: ready
lane: integration-runtime
lane_seq: 1
collision: [release/manifest]
closed: 2026-10-24
closed_by: agent
---

# Install the pinned integration tools with every installation

## Description

Jari 2026-10-24: on the Northwind pilot every integration is disabled, including plain IMAP, CalDAV and CardDAV, which need no app credentials. Cause: the daemon's catalog (`internal/daemon/integrations/catalog_linux.go`) marks an entry available only when `/opt/open-habitat/integrations.json` names its pinned tool, and a product installation never writes that file or installs the tools (docs/operations.md: integrations are manual operator steps; Fleetrepo does them on the test server).

Jari: **the integration tools are always installed.** Every installation ships the pinned tools (himalaya for IMAP, the DAV tool used by `dav_linux.go`, gog v0.39.1, rclone v1.71.2, and whatever Microsoft uses) as part of the release runtime closure, and `host prepare/apply` writes the `tools` section of integrations.json (root-owned, readable by mapped users), preserving any app credentials already there. With that, IMAP/CalDAV/CardDAV are available out of the box; Google, Microsoft and Dropbox still need app credentials, which will be entered through the server admin UI (separate prototype `proto-server-integrations-setup`).

## Acceptance Criteria

- [x] A fresh installation (cloud qualification VM, `scripts/cloud-qualify.py`) shows IMAP, CalDAV and CardDAV available and Google/Microsoft/Dropbox as "needs app credentials"; tool pins, licenses and SBOM entries in the release manifest; integrations.json tools written idempotently without touching credentials; upgrade test.
