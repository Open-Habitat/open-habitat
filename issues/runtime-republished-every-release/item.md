---
created: 2026-11-21
updated: 2026-11-21
type: improvement
status: testing
priority: normal
provenance: other
source_ref: taskfleet:01m7z7zq68c0zjn6rzp5d700d6/runtime-install-time
originating_run: 01m7z7zq68c0zjn6rzp5d700d6
originating_run_kind: spinoff
lane: release-runtime
lane_seq: 1
preparation: ready
---

# Reuse unchanged authenticated runtime payloads across release identities

## Description

## Observed problem

Our test installation repeatedly exceeds its 100-second installation budget even when the runtime archive is unchanged. This is a measured regression, not a request to bypass authentication or raise the limit.

On 2026-11-21, twelve completed installations took 211.613–238.442 seconds (median 224.490). One representative installation took 226.686 seconds: prepare 28.008, runtime verification before switch 34.411, switch 100.033, final verification 10.847. Switch includes service work and runtime publication; existing receipts do not separate extraction, fsync, runtime attestation and service restart, so the entire 100.033 seconds must not be attributed to extraction alone.

Across four consecutive releases the core archive SHA-256 stayed `733a0794b2a3b4d648024742bc992e10b976c5389fca457857607643b8663c81` (498,307,345 bytes), but each release had a different manifest digest and a missing runtime generation. Transfer sent only release.json: downloading the core again was not the recurring bottleneck. The integrations archive was 182,905,819 bytes. Final core attestation checked 22,585 files.

## Source-grounded cause

At product commit ae139bdb30b59f6181efa0b9227dc475fe26be95:

- `scripts/prepare-release-closure.py` already reuses content-cached archives but writes a new release identity manifest.
- `internal/host/runtime_install_linux.go` names the generation from the full release-manifest digest, calls `stageRelease` and `syncTree` before checking whether that generation exists, and couples publication with selector changes.
- `internal/host/release_stage_linux.go` spools/authenticates archives, preflights tar inventories, then extracts the core again. Repeated identical payloads still require a new tree for a new manifest identity.
- `cmd/runtime-release/main.go` verify checks all profiles, while install selects core only. Removing the operator's earlier full verify would therefore lose integrations checks; it is not an equivalent optimization.

The transition to product-owned runtime installation (introduced by cf803d73 on November 14) coincided with our switch increasing from about 20 to about 100 seconds. The caller also changed at that boundary, so this is not an isolated product benchmark. Build preparation rose from about 14 to about 26 seconds, far less than the switch increase.

## Requested outcome

Provide a product-owned way to reuse authenticated unchanged runtime content across release identities and/or prepare publication before the short selection window. Preserve exact release identity, archive digest and inventory checks, file authority/modes, durable publication, selector rollback, operation locking, and safety for processes still using prior generations. Do not replace a fresh trust check with existence of a cache directory or an old receipt, and do not let two mutable generations share writable payloads.

Add separate timings for authentication, archive preflight, extraction, durability and selection. Benchmark warm unchanged-runtime updates and a runtime-pin change separately. Demonstrate whether the full installation can fit 100 seconds after optimizing; moving work outside the stopped-service window alone reduces downtime, not end-to-end duration.

No product code or live installation was changed during this investigation. Detailed operator timings are retained privately; this report contains only product identifiers and aggregate measurements.
