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

## Watched web-only commit

Fleetrepo `9f0ec943ccc71171710ed30d6ad2be50df678cd3` installed an inert Alder user-systemd template through the fleet unit. The watcher was started as `open-habitat-test-watch@28.service` after verified pilot.27. Its first run exited on an in-progress edit of `main`; Fleetrepo `2a77688c6048dfd6dfc173386f7b4f3cbc8bdb6b` made it skip dirty ticks instead of stopping. A second attempt detected pushed web-only commit `fe62b54964bce4996b1bc085ea8641c13cbd457c` but failed during local `prepare` (exit 127: Go absent from the systemd service PATH). Fleetrepo `063daeee788091aef15102a648b8a7269b3755d6` added the declared Go toolchain path and documented the pre-staging recovery. The failed receipt was preserved here as `release-test-receipt-pilot28-failed-prepare.json`; no guest staging or switch occurred. After removing only that failed local output/summary and restarting the same unit, **the watcher itself deployed pilot.28**. Its verified receipt is `release-test-receipt-pilot28.json` (ungated; product tree `7b9f9dfe8e9f3b210347435b9210ce96e4aa434a`). The unit was stopped using the documented `systemctl --user stop open-habitat-test-watch@28.service`; systemd readback: `inactive/dead`, exit status 0. Its local `state.json` advanced to pilot.29 and the deployed source. The watcher did not deploy an uncommitted tree. `./scripts/test-web-fast.sh` passed on the web-only commit.

**Web-only timing: 51.529 s**, not the seconds-scale target: prepare **18.929 s** (cold npm install/build and Go package), stage closure 1.270 s, archive 5.010 s, successor preflight/stage/switch/verify 2.756 / 3.145 / 8.197 / 2.513 s. The full release path preserves the guest's authenticated unbranched chain: its selected binary embeds the exact new source commit, and its web bytes are covered by the archive manifest. Reusing the older binary with new web bytes under that same source would make the embedded identity false. A true asset-only path needs a separately authenticated, atomic web overlay and guest receipt that the next full successor can check. That is a new product/guest release contract; it was not built here. **The web-only performance acceptance criterion is not met.** The tested full successor is faster (36.331 s), but calling the web-only pilot fast would conceal its 51.529 s result.

Fleetrepo commits: `9f0ec943ccc71171710ed30d6ad2be50df678cd3` (operator, watcher and tests), `2a77688c6048dfd6dfc173386f7b4f3cbc8bdb6b` (dirty-tree behavior), `063daeee788091aef15102a648b8a7269b3755d6` (service PATH), `395d59c8` (current private inventory). The product Go and web commits landed independently on pushed `main`; this worktree carries the deployment documentation and receipts. The pilot.28 successor readback and operator receipt prove release selection, not Jari's browser sign-in or Pi authorization.
