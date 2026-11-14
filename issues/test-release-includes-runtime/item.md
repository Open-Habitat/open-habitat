---
created: 2026-11-13
updated: 2026-11-14
type: improvement
status: done
priority: normal
provenance: chat
source_ref: conductor:2026-11-13/test-release-runtime
lane: runtime-release
lane_seq: 1
preparation: ready
closed: 2026-11-14
---

# Test releases: build or reuse the runtime release with the package

## Description

## Proposal

Add an option to `scripts/prepare-release.sh` that also builds the runtime release (or reuses one whose runtime inputs are unchanged), so that a per-commit test release is a complete release, as published ones are. A test installation could then run each release's own core runtime without rebuilding it outside the product from a guess at the build's inputs.

Raised 13.11.2026 when our test installation moved to the release-bundled core runtime.

## Acceptance Criteria

- [x] An explicit preparer option builds or content-reuses the required runtime closure with existing builders and manifest validation.
- [x] Disposable caching and native/foreign architecture behavior are documented and tested offline.
- [x] Independent closure review is resolved; watcher handoff and live-check limits are recorded in result.md.
