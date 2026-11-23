---
created: 2026-11-23
updated: 2026-11-23
type: bug
status: fixed
priority: normal
provenance: chat
source_ref: taskfleet:01m83dpsvvd5q58x65kabyjgkd/task
originating_run: 01m83dpsvvd5q58x65kabyjgkd
originating_run_kind: spinoff
closed: 2026-11-23
---

# Release verifier rejects the reviewed person-removal broker unit

## Description

Release preparation fails with packaged broker ReadWritePaths differs or duplicates after person removal added host temporary-directory and spool cleanup. scripts/verify-release.sh still expects one ReadWritePaths entry and PrivateTmp=yes; systemd/open-habitat-broker.service now carries two entries and PrivateTmp=no. Pin the exact reviewed values without relaxing directive inventory validation, add re-signed package regressions, and verify a built package. Check operator-unit documentation and report the installation-preflight delta separately.

## Acceptance Criteria

- [x] Exact reviewed broker directive values pass package verification; altered values and inventories fail.
- [x] Native built package and re-signed archive regressions pass.
- [x] Provisioning unit tests and independent critical review complete.
- [x] Operator preflight delta and evidence limitations recorded in result.md.
