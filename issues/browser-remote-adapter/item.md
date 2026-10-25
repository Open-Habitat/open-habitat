---
created: 2026-10-19
updated: 2026-10-25
type: task
reporter: jari
status: done
priority: normal
preparation: ready
lane: gate-health
lane_seq: 4
collision: [gate]
closed: 2026-10-20
closed_by: agent
---

# Route focused browser checks through the shared remote runner

## Goal

Move the whole focused browser workload off Alder into Fleetrepo's bounded
Linux ARM64 guest while retaining source/edit/merge authority on Alder.

## Authorized delivery

Jari authorized implementation and real routed acceptance on 2026-10-20.
Fleetrepo `d8da1252` released the external blocker with the installed 0.1.0
runner (source `4f196cf057b55f9fef07d0be93567890a23701c6`). Its
`issues/orx-background-runner/infra-ready.md` was read in full and readiness
and authorization recorded via issuectl before implementation. This supersedes
the earlier preparation-only direction; `preparation: ready` approves this
concrete adapter, not expanded gate/lab execution.

The adapter and failure-boundary fixtures are implemented. [result.md](result.md)
records exact commands, real input identities, observed failures and verification.
No capture engine, SSH transport, queue, dependency installer or task lifecycle
was added to OH. The full gate remains unavailable on Alder during this
ordinary-one-spec/no-tag pilot. Normal unrelated Linux development/CI retains
local behavior; forged guest environment on Alder does not permit local work.

## Acceptance Criteria

- [x] Fleetrepo infra-ready evidence, actual runner schema/version and concrete adapter authorization recorded before implementation.
- [x] Focused script and maintained npm browser entrypoint route or refuse clearly; no heavy Alder fallback or recursive resubmission.
- [x] Whole workload including dependency installation/build/fixture/browser executes under guest limits; ARM64 native dependencies and temp storage verified.
- [x] Small adapter failure-boundary tests pass and one dirty-snapshot real ARM64 smoke plus a credential-backed focused spec have receipts.
- [x] Results identify immutable source/platform, stale source and non-success classes correctly; no source writeback or clean-gate/amd64/UID-isolation claim.

## Out of scope

Full-suite/lab/tag expansion, full-gate receipts, amd64 packaging, distinct-UID
proof, infrastructure maintenance and the existing account-settings assertion
failure are not part of this adapter. Fleetrepo's credential run remains
**11 passed, 1 failed**, not a green suite. Its native synthetic credential
add/switch/remove case passed. No application assertion was weakened or deleted.

## Decisions

### 2026-10-20T07:48:13Z · @agent

Implementation authorized by Jari on 2026-10-20 (Taskfleet 01m5c4f8gst5h9x1rq7jwrpht0). Fleetrepo d8da1252 infra-ready.md read in full: installed fleetrepo-exec 0.1.0 source 4f196cf0, actual create/wait API, private ext4 temp, dependency preparation and native credential proof released the blocker. Proceed with narrow no-tag ordinary-spec adapter and fresh routed dirty/untracked anonymous acceptance; this supersedes preparation-only instruction. Existing account-settings 11 pass/1 fail remains non-green application evidence.

## Resolution

### 2026-10-20T08:02:13Z · @agent

Delivered narrow adapter: 24 cheap fixtures passed; final npm routed ARM64 job 992423b86a98bdb8c5e0a53dc4917eafefe499f9d0d8fcea7146aa35ef532b3d passed 2/2. All 2484 captured files unchanged; same-job reconnect surfaced deliberate staleness. Native credential evidence remains 11 passed/1 failed, not green. No full-gate/amd64/deployment claim; parent owns push/publication.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
