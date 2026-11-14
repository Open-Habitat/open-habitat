---
created: 2026-11-14
updated: 2026-11-14
type: bug
status: open
priority: normal
provenance: other
source_ref: conductor:2026-11-14/gate-page-reader-order
lane: gate-order
lane_seq: 1
preparation: ready
---

# Clean gate from an empty cache fails: page-reader test runs before Playwright browsers are installed

## Description

## Observed (14.11.2026)

`./scripts/ci-local.sh --clean --json` in a fresh `git clone --no-local`
(empty `.cache/ms-playwright`) fails in the dependencies phase:
`internal/daemon/pi-device-test/page-reader.test.mjs` throws "no Chromium
headless shell under …/.cache/ms-playwright", because `node --test
internal/daemon/pi-device-test/*.test.mjs` (line ~118) runs before `npm exec
--prefix web playwright install chromium` (line ~119), and that install does
not include `chromium-headless-shell`. Gates passed before only because a
reused clone already had the browsers cached.

## Expected

The clean gate is self-sufficient from an empty cache: install the browsers
the device tests need (including the headless shell) before running them.
