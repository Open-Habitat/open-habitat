---
created: 2026-10-20
updated: 2026-10-20
type: task
status: untriaged
priority: normal
provenance: chat
source_ref: taskfleet:01m5ce8pjvq2k8x4v2f1dvkdn8/request
originating_run: 01m5ce8pjvq2k8x4v2f1dvkdn8
originating_run_kind: spinoff
---

# Route complete Open Habitat test and build commands through shared execution

## Description

## Description

The maintained browser command and local CI entrypoint on Alder refuse full suites, lab and tags, and normal web/Go checks still run locally. Extend the shared runner consumer beyond the focused pilot: named repository tasks, ordinary commands, verified nonrecursive guest execution, real ARM test health separately attributed from native amd64 packaging, and explicit output exports. Requested by Jari through the Fleetrepo shared-runner parent; the earlier focused pilot is not this scope.

## Acceptance Criteria

- [x] Ordinary browser/lab/focused/tag, web checks, Go/contracts and CI health dispatch before heavy local setup on Alder, without fallback.
- [x] Cheap hermetic regression checks cover dispatch, failures and trusted guest identity; other native Linux hosts retain local execution.
- [ ] Full live ordinary/lab/gate proofs run after parent installs runner 0.2; actual application failures remain failures.

## Verification

Live acceptance depends on the parent's main-only shared runner upgrade. Installed version at worker start is 0.1.0; no upgrade is authorized here.
