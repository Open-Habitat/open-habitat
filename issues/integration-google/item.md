---
created: 2026-10-18
updated: 2026-10-20
type: feature
reporter: jari
status: open
priority: high
epic: agent-integrations
preparation: ready
lane: integrations
lane_seq: 2
collision: [internal/daemon/integrations]
blocked_by: ['@integrations-catalog-core']
---

# Integration: Google (Drive sync, Gmail, Calendar, Contacts)

Google entries on the catalog core: Drive continuous two-way sync with rclone into `~/cloud/google-drive/<account>/`; Gmail, Calendar and Contacts via `gog`; several accounts. Needs the operator's Google OAuth client configured host-wide (Fleetrepo for the test server; a Testing-mode client with Jari's accounts is enough there, tokens expire after 7 days). The personal-data skill gains the Google accounts.

## Acceptance Criteria
- [ ] Connect, use from an agent, add a second account, remove; tested in a disposable home with fakes and live once on the test server with Jari.

Follows ADR 0026 (integrations catalog, accepted by Jari 2026-10-18) and the prototype `proto-integrations` (direction Tili; `design-system/prototypes/rounds/2026-10-18-integraatiot/`; feasibility findings and Jari's decisions in its `result.md`). Every tool runs as the person; tokens stay in the tool's own store in their home; nothing about connections is stored by the host.

## Comments

### 2026-10-20T10:42:45Z · @conductor

Operator Google client for the test server exists (2026-10-20): project open-habitat-test, Desktop/installed client 874065012797-su3pbteijgklso1gkm5en4jcevkec1p0.apps.googleusercontent.com, redirect http://localhost. The client JSON is held on Alder at ~/.local/state/open-habitat-integration-apps/google-client.json (0600) until this integration ships and Fleetrepo writes it into the test server's integrations.json.

### 2026-10-20T10:52:26Z · @conductor

Correction: the Google client is now stored SOPS-encrypted in Fleetrepo infra/secrets/open-habitat-test-integrations.yaml (key google); the plain copies on Alder and in Jari's Downloads were removed.
