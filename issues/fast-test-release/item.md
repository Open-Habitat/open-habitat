---
created: 2026-10-12
updated: 2026-10-12
type: improvement
status: in-progress
priority: high
preparation: ready
lane: release-tooling
lane_seq: 1
collision: [scripts/, TESTING.md]
---

# Release to the test guest in under 100 seconds

_Source: chat_

Jari, 2026-10-12: a test-guest release should take under 100 seconds. The pilot.23 in-place release (run `01m4r8bt54p10bgxf98nezdm3s`, 14:30:45–14:47:23 UTC) took 16 min 38 s:

| Step | Time |
| --- | --- |
| Clean gate (`ci-local.sh --clean`) rerun inside the release | ~657 s |
| LLM-written receipts, TODO, inventory, commits | ~180 s |
| Orientation (reading instructions) | ~50 s |
| Guest transfer, successor switch, readback | ~60 s |
| Package and verify | ~30 s |

Measured from the worker's Pi session (tool calls 55 s in total; the rest is the background gate and model turns).

Make the release one deterministic command that the conductor runs directly, finishing in under 100 s end to end, and reporting its own duration:

1. **Gate receipt by tree.** `ci-local.sh --clean` records a receipt keyed by the committed tree (`git rev-parse HEAD^{tree}`) and the gate inputs it covers. The release accepts that receipt when the release commit's tree matches and refuses otherwise; it never reruns the gate itself. Workers already run the clean gate on their final tree before merging, so on a sequential lane main's tree normally has a receipt. This follows TESTING.md's existing reuse rule; update TESTING.md and RELEASE-UPGRADE.md to describe it.
2. **One command** (product `scripts/` for build, package and verify; Fleetrepo's test-guest operator for transfer, successor switch and readback) chaining package → verify → transfer → switch → readback, with machine-written receipts (JSON) in place of LLM-edited prose. Prose docs are updated only when behaviour changes.
3. **Duration budget.** The command prints per-step and total durations and fails its own acceptance above 100 s on the test guest; record the measured time of the first real release in the result.

Keep every existing safety check of the upgrade path (source pinning, archive and manifest digests, guest identity, root-only receipts); make them fast rather than removing them. The gate's own 11-minute duration is a separate concern.
