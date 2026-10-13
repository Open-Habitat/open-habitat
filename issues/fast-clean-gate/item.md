---
created: 2026-10-13
updated: 2026-10-13
type: improvement
reporter: jari
status: open
priority: high
lane: release-tooling
preparation: ready
lane_seq: 2
---

# Compress the clean gate to the release's time class

# Compress the clean gate to the release's time class

Jari (2026-10-13): the one-command test release now takes 55 s, but the clean
gate it requires takes 11 minutes, so a change still reaches the test server
about 12 minutes after landing. The gate should compress into the same time
class as the release.

## Where the time goes

Measured on alder for tree `a3cdbd23fdf60a27af3a1c33937bff0d60e897dd`
(`ci-local.sh --clean`):

| Phase | Seconds |
| --- | --- |
| setup, dependencies, web-checks, packaging, final | 40 |
| browser (142 Playwright cases + lab suite) | 470 |
| go-and-contracts | 84 |

The browser phase runs serially because the synthetic host's fixture scenario
is process-wide: parallel browsers against one host would interfere
(`web/lab/capture-inventory.mjs` and `web/AGENTS.md` say so).

## Direction

- Give each Playwright worker its own `browser-host` instance on its own port
  (a per-worker fixture that starts the host, or a host that namespaces the
  fixture state per connection), then run the suite with several workers.
  This is the bulk of the saving.
- Keep Go build and test caches warm between runs (`GOCACHE`, `GOFLAGS`) and
  run package tests in parallel; the contracts drift check is cheap.
- Reuse unchanged phase results by content hash where a phase's inputs are
  identifiable (web dependencies by lockfile hash, Go by module and source
  hash), without weakening the clean-tree receipt: the receipt still names
  the committed tree, and a reused phase must be recorded as reused in it.

Target: under two minutes for a warm run; the clean-tree and receipt
semantics in `TESTING.md` and `scripts/gate-receipt.py` stay unchanged.

## Acceptance Criteria

- [ ] `./scripts/ci-local.sh --clean --json` on a warm alder finishes in under two minutes and still writes the receipt.
- [ ] Browser cases pass with parallel workers without shared-fixture interference; `TESTING.md` and `web/AGENTS.md` describe the per-worker host.
- [ ] `release_test.py` accepts the receipt unchanged.
