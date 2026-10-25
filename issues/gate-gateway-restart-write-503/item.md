---
created: 2026-10-19
updated: 2026-10-25
type: bug
status: fixed
priority: normal
provenance: agent
source_ref: taskfleet:01m59s0gver2290c0gbgedgwt1/test-failure:go-gateway-write-after-restart-503
originating_run: 01m59s0gver2290c0gbgedgwt1
originating_run_kind: spinoff
related: ['@gate-load-flakes-1019']
lane: gate-health
preparation: ready
closed: 2026-10-19
---

# Loaded gateway restart test returns daemon_unavailable on write

## Description

## Observed occurrence

During parallel loaded verification for @gate-load-flakes-1019, `go test -race -count=1 ./...` failed in `TestConversationGatewaySessionBoundary` at `internal/gateway/conversation_linux_test.go:253`: the POST after constructing a fresh gateway returned 503 `daemon_unavailable` instead of 200. The preceding status read through that gateway passed. The failure occurred while eight browser workers repeated the held-message reload journey.

Command used `umask 077` and a fresh short disk-backed TMPDIR under `/var/tmp`. Complete retained log on Alder: `/var/tmp/oh-gate-load-held-reload-go.log`.

The same full Go suite passed several earlier loaded runs, including all completed clean gates in this worker. No gateway implementation or test code was changed. This occurrence does not establish a live-host outage or a root cause. Inspect the Unix HTTP fixture/connection lifecycle and the request failure before changing transport policy or adding retries.

## Impact

A required validation run is red. The gateway failure is not an archive census or an accepted-observation re-read, so the repair worker stopped rather than widening into gateway transport work.

## Reproduction

Run the full Go/race suite concurrently with eight-worker repeated host-backed browser cases, for example the `queued-send.spec.ts` held-message reload case. This is an intermittent observed failure, not a deterministic reproducer.

## Acceptance Criteria

- [x] Diagnose the intermittent Unix HTTP failure without adding write retries.
- [x] Post-restart gateway boundary passes 1,000 repetitions under browser load.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
