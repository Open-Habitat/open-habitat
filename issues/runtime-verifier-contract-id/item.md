---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: conductor
status: done
priority: normal
lane: release-runtime
lane_seq: 5
preparation: ready
closed: 2026-11-22
---

# runtime-release verifier declares a stable verification contract

## Problem

Our test installation's operator reuses a successful runtime-input verification across upgrades only when the `runtime-release` verifier binary's digest is in a hand-maintained audit map, because the product gives no stable statement of what a verifier checks. Every rebuilt verifier binary (a new Go toolchain, an unrelated package change) silently turns reuse off again, and each install pays ~34 s of full re-verification until someone audits the new digest (seen four times on 21.–22.11.2026).

## Expected

The product's `runtime-release` verifier declares a stable verification-contract identifier (bumped only when what it verifies changes), printed in its machine output and bound to the release manifest, so an installer can key its reuse on the contract instead of the binary digest — without trusting an unknown binary more than today (an unknown or newer contract still verifies fully).

## Acceptance Criteria

- [x] Stable verifier ID is queryable and returned in successful verification JSON; the manifest writer authenticates its declaration inside the pinned manifest.
- [x] A source-change tripwire requires a deliberate semantic review and the nearest AGENTS.md defines the bump rule.
- [x] Existing checks remain in place, including for old/unknown declarations; focused tests, packaging checks and targeted release-trust review pass.
- [x] External operator reuse conditions and evidence limits are recorded in result.md and the worker report.
