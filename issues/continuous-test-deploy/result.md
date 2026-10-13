# Continuous test deployment

## Baseline live successor (2026-10-13)

From clean pushed product `main` `ede3743ceddca60d4242de824cd99f01e165a352` (tree `33a5491226f2067e6671477867b85b63dfd885af`) and Fleetrepo `be269807522b8b3a9bd6c303850d29591a6fb8dc`, `release_test.py --ungated --version 0.0.0-pilot.26 --output /var/tmp/open-habitat-continuous-baseline-26` verified the live guest in **53.470 s**. Its receipt is `/var/tmp/open-habitat-continuous-baseline-26/release-test-receipt.json` (`gate: ungated`, source/tree and artifact/manifest digests recorded). This was a full successor, not the web-only comparison.

| Phase | Seconds |
| --- | ---: |
| Pin and recheck product + Fleetrepo | 4.209 |
| Prepare (npm install, web and Go builds, package verification) | 8.151 |
| Create guest stage | 2.078 |
| Stage ten closure scripts (separate SSH transfers and hash readbacks) | 18.289 |
| Stage archive and sidecar | 5.458 |
| Successor preflight / stage / switch / verify | 15.042 (2.456 / 2.795 / 7.447 / 2.344) |
| Guest pin and local archive inspection | 0.160 |

The per-step entries are nested under `deploy` (40.946 s) and should not be added to it twice. The remainder is local bookkeeping and transfer latency. The baseline receipt proves the selected release, not browser login or Pi authorization.

## Faster full successor: Go change

Fleetrepo `9f0ec943ccc71171710ed30d6ad2be50df678cd3` batches the ten-file closure into one bounded, verified guest transfer. The first attempt at pilot.27 against **the unchanged pilot.26 source** stopped safely at `stage_closure`: the source-named stage was already occupied, and no switch occurred (`/var/tmp/open-habitat-continuous-full-27/release-test-receipt.json`). A successor needs a new source commit, not merely a new version number.

After the gateway cache-header change on pushed product `main` `a516a59b7ada3fae08296f1bb9921d1d58766e79` (tree `176c096318e44b5a2f3d4068f8177cd547ab608f`), pilot.27 deployed and verified live in **36.331 s** (`/var/tmp/open-habitat-continuous-go-27/release-test-receipt.json`, ungated). Prepare 7.626 s, guest stage parent 1.884 s, closure **1.176 s** instead of 18.289 s, archive 4.324 s, sidecar 1.685 s, successor preflight 2.396 s, extraction stage 2.645 s, switch 7.359 s, verify 2.354 s. Product/Fleetrepo pins and rechecks totaled 4.043 s. The full deployment improved by 17.139 s from baseline. The running gateway now sends `Cache-Control: no-store` on the UI shell so new hashed assets are discovered after a deploy; `go test ./internal/gateway -count=1` passed on that change.
