---
created: 2026-10-13
updated: 2026-10-13
type: improvement
reporter: jari
status: open
priority: high
lane: release-tooling
lane_seq: 1
preparation: ready
---

# Test-server release without the clean gate

# Test-server release without the clean gate

Jari (2026-10-13): the test server is disposable, so its release must not
wait for the 11-minute clean gate. A broken release is fixed forward or
replaced. The policy is now in `CLAUDE.md`; this issue implements it.

## What changes

- Product `scripts/prepare-test-release.sh` gets an `--ungated` mode that
  skips `gate-receipt.py check`, still requires a clean committed tree (so the
  source commit is exact), builds and verifies the package as before, and
  records `gate: "ungated"` plus the tree hash in the package manifest or a
  sidecar the operator reads. The default stays gated.
- Fleetrepo `infra/open-habitat-test/release_test.py` gets `--ungated`, passes
  it through, and writes `gate: "ungated"` into `release-test-receipt.json`
  and the printed result. The successor chain, digests, SSH pinning and the
  100 s acceptance are unchanged. Its offline tests cover both modes.
- `TESTING.md` and Fleetrepo `RELEASE-UPGRADE.md` describe the two modes:
  ungated is the normal test-server path, gated remains for a release whose
  receipt must prove testing (and for production later). The inventory
  records whether the current guest release was gated.

Keep the gate itself unchanged; `fast-clean-gate` makes it faster separately.

## Acceptance Criteria

- [ ] `release_test.py --ungated --dry-run` and a live `--ungated` release work from a clean pushed main without a gate receipt and the receipt says `ungated`.
- [ ] The gated path behaves exactly as before and refuses a missing receipt.
- [ ] Fleetrepo offline tests and the product's `scripts/test-gate-receipt.py` pass.
