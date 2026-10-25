---
created: 2026-10-19
updated: 2026-10-25
type: bug
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-10-21
---

# GET /api/v1/pi/models takes 3 s and runs every minute

Conductor's observation on the test VM, 2026-10-19 07:45–07:55 UTC: the daemon logs `"slow":true` for `GET /api/v1/pi/models` about once a minute, 2.6–4.0 s each (e.g. request_ids `S20Grn9ITwXjWwkI`, `pGVNhcz9PHfAhvGy`, `lh44Pld_elNa1yEu`), and `GET /api/v1/onboarding/pi/status` at 1.7–2.0 s. Find what the model list does on every call (spawning Pi? reading provider catalogues?) and whether the browser polls it once a minute. Pressing **+** or opening Asetukset › Agentit waits on it.

## Acceptance Criteria

- [x] Identify the per-request native work and minute polling source.
- [x] Validate the operator-owned runtime at startup rather than walking its dependency tree on each model/credential/Claude-status read; retain per-operation configuration and native-store safety checks.
- [x] Stop idle minute polling while preserving preload, focus, picker-open and mutation reads.
- [x] Run affected checks, compare known daemon failures with the unchanged baseline, and record measured timings and remaining live-server verification.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
