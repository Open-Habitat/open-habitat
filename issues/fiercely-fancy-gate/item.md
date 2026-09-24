---
created: 2026-09-24
updated: 2026-09-24
type: task
status: untriaged
priority: normal
provenance: other
provenance_detail: Accepted prepare-login-pilot dependency boundary
source_ref: taskfleet:01m39h2wy5hhd8m4fr21qvt3n8/pilot-integration-gate
originating_run: 01m39h2wy5hhd8m4fr21qvt3n8
originating_run_kind: spinoff
---

# Gate first-login pilot on executable prerequisites

## Description

## Goal
Prevent the first-login pilot from being launched merely because its preparation issue closes. This is a conductor-owned integration gate, **not** a self-accepted implementation or deployment issue. The public app still lacks a Linux executor, root broker service/package, dynamic per-request gateway authorization and native gh JIT integration; Fleetrepo still lacks approved private root broker, verified host key and safe ingress/activation. See `issues/prepare-login-pilot/plan.md` for bounded suggested slices and proof matrix.

## Acceptance Criteria
- [ ] Conductor compares current public and Fleetrepo DAGs, dispositions the proposed app prerequisite slices with Jari, accepts and lanes only independently verifiable work, and adds real dependency edges to `@deliver-login-pilot`.
- [ ] Record landed public and Fleetrepo revisions and explicit identity, host-key and ingress approvals; keep the pilot blocked while any are absent.
- [ ] Establish tested clean-gate, private guest, observed live-version and service-aware rollback receipts before releasing this integration gate. No guessed activation or rollback commands.
