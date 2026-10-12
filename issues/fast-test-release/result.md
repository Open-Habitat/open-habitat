# Fast test-guest release

Implementation prepared in product and Fleetrepo. The guest remains frozen for Jari's walkthrough: no live release or guest contact was performed in this run. The first live <100 s measurement is pending the conductor's release; issue remains in-progress.

## Command for conductor

From Fleetrepo's root on Alder, with the gated product checkout on its approved pushed source revision:

```sh
python3 infra/open-habitat-test/release_test.py --product-repo ~/Sources/native-agent-host --version <next-version>
```

Use the operator's `--help` for guest/inventory parameters and dry-run syntax. The operator emits machine-readable receipts and step/total durations; it rejects a live release over 100 s. The product preparer is `scripts/prepare-test-release.sh --version <version> --output <dir>` and refuses a missing or different-tree clean gate receipt.

## Decisions for review

- The gate receipt is local ignored evidence under `.cache/ci-local/receipts/<tree>.json`, not a signed assertion. The committed tree captures runnable and packaging inputs; a changed commit with the same tree may reuse the pass while the release embeds its selected commit SHA. A changed evidence document changes the tree and needs a new pass.
- The release command rebuilds web/dist rather than trusting ignored old assets. It packages and verifies a fresh binary and checks its source/version against the pinned checkout.
- The guest is frozen; the 100 s acceptance and live readback can only be measured by the conductor's first real release.

## Offline evidence

`python3 scripts/test-gate-receipt.py` verifies same-tree acceptance, different-tree refusal, dirty-tree refusal and corrupt receipt refusal. The final clean gate and Fleetrepo offline tests are recorded in the run's completion report; no real guest operation was attempted.
