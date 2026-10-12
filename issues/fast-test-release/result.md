# Fast test-guest release

Implementation prepared in product and Fleetrepo. The guest remains frozen for Jari's walkthrough: no live release or guest contact was performed in this run. The first live <100 s measurement is pending the conductor's release; issue remains in-progress.

## Command for conductor

From Fleetrepo's root on Alder, with the gated product checkout on its approved pushed source revision:

```sh
python3 infra/open-habitat-test/release_test.py \
  --product ~/Sources/native-agent-host \
  --version 0.0.0-pilot.24 \
  --output /var/tmp/open-habitat-release-24
```

Use a fresh private output directory for this attempt. If it was already used, choose a different new private path. Use the operator's `--help` for dry-run syntax. The operator emits machine-readable receipts and step/total durations; it rejects a live release over 100 s. The product preparer is `scripts/prepare-test-release.sh --version <version> --output <dir>` and refuses a missing or different-tree clean gate receipt.

## Decisions for review

- The gate receipt is local evidence under the shared Git common directory (`open-habitat-gate-receipts/<tree>.json`), not a signed assertion. Linked worktrees and main share it. The committed tree captures runnable and packaging inputs; a changed commit with the same tree may reuse the pass while the release embeds its selected commit SHA. A changed evidence document changes the tree and needs a new pass.
- The release command reinstalls locked web dependencies and rebuilds web/dist rather than trusting ignored old assets or node_modules. It packages and verifies a fresh binary and checks its source/version against the pinned checkout.
- The guest is frozen; the 100 s acceptance and live readback can only be measured by the conductor's first real release.

## Offline evidence

`python3 scripts/test-gate-receipt.py` verifies same-tree and linked-worktree acceptance, different-tree refusal, dirty-tree refusal and corrupt receipt refusal. A real product preparer plus Fleetrepo offline dry run (with only the pushed-main ancestry probe replaced for this unmerged feature branch) verified archive `6d48d13aa4e0d9a6483eed1d327ed8b31b9f89de7214f4eebd76a88c93623ae0` in 5.143 s and blocked every guest call. Fleetrepo's 205 offline tests passed. The full clean gate passed on the then-current merged candidate tree `ff587c2c3d1423eb617cf107e1c137af8cdfde04` (`/var/tmp/oh-fast-test-gate-merge.out`); earlier browser-test flakiness was retried. Concurrent changes to main and this evidence-only update mean that **the eventual main tree has no gate receipt yet**. The conductor must gate the landed clean main tree once before invoking the command above; that prerequisite is outside the 100 s release timing. No real guest operation was attempted.

## First live release (2026-10-12, pilot.24)

The conductor gated the landed main tree `a3cdbd23fdf60a27af3a1c33937bff0d60e897dd`
(commit `09e2dfde9eeaa3bc67a9654e964c6313b2e2347c`, the agent-turn and bash-card
implementation) and ran the command above from Fleetrepo main
`66c330e670457d0c4019370d281ea04b34fd5ed6`. Result `status: verified`,
`acceptance: within_limit`, total **55.3 s** (prepare 5.4 s, staging of the
ten-file closure and archive about 30 s, preflight, stage, switch and verify
16.2 s). Receipt: `release-test-receipt-pilot24.json` in this folder. The public
edge answered 200 on `/` and 302 on `/auth/github/start` afterwards. The first
gate attempt on the same tree failed only because an orphaned lab server from a
deleted worktree held port 4175; the browser suite itself passed. Browser
sign-in and the rendering of real conversations on pilot.24 remain Jari's check.
