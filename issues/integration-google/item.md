---
created: 2026-10-18
updated: 2026-10-25
type: feature
reporter: jari
status: done
priority: high
epic: agent-integrations
preparation: ready
lane: integrations
lane_seq: 2
collision: [internal/daemon/integrations]
blocked_by: ['@integrations-catalog-core']
closed: 2026-10-20
---

# Integration: Google (Drive sync, Gmail, Calendar, Contacts)

Google entries on the catalog core: Drive continuous two-way sync with rclone into `~/cloud/google-drive/<account>/`; Gmail, Calendar and Contacts via `gog`; several accounts. Needs the operator's Google OAuth client configured host-wide (Fleetrepo for the test server; a Testing-mode client with Jari's accounts is enough there, tokens expire after 7 days). The personal-data skill gains the Google accounts.

## Acceptance Criteria
- [x] Native account connection, generated agent skill, multiple accounts and removal tested in disposable homes with fakes; focused host/browser checks pass.
- [ ] Live test-server verification with Jari after conductor configuration/deployment (not authorized for this worker).

Follows ADR 0026 (integrations catalog, accepted by Jari 2026-10-18) and the prototype `proto-integrations` (direction Tili; `design-system/prototypes/rounds/2026-10-18-integraatiot/`; feasibility findings and Jari's decisions in its `result.md`). Every tool runs as the person; tokens stay in the tool's own store in their home; nothing about connections is stored by the host.

## Comments

### 2026-10-20T10:42:45Z · @conductor

Operator Google client for the test server exists (2026-10-20): project open-habitat-test, Desktop/installed client 874065012797-su3pbteijgklso1gkm5en4jcevkec1p0.apps.googleusercontent.com, redirect http://localhost. The client JSON is held on Alder at ~/.local/state/open-habitat-integration-apps/google-client.json (0600) until this integration ships and Fleetrepo writes it into the test server's integrations.json.

### 2026-10-20T10:52:26Z · @conductor

Correction: the Google client is now stored SOPS-encrypted in Fleetrepo infra/secrets/open-habitat-test-integrations.yaml (key google); the plain copies on Alder and in Jari's Downloads were removed.

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.

## Worker result

Implementation and final focused validation are complete; see [result.md](result.md)
for exact tested revision, successful jobs, review, remaining live verification
and operator handoff. Prior blocked retries remain in git history.
