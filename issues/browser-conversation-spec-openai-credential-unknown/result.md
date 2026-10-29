# Result

Same root cause as `settings-search-spec-recap-custom-rows`: the reporting runs
lacked `internal/daemon/pi-device-test/node_modules`. The synthetic host's
OpenAI credential read goes through that pinned Pi SDK (`PiCredentialsHandler`
with the fixture `PiDevice`). When the SDK is missing, the read fails and the
row honestly reports `unknown`. Neither the product nor the spec is wrong;
`unknown` is the correct state when the credential read fails.

Evidence (Birch, `OH_PORT_BASE=8000`): passes on current main (bb321d64) and
on ba2a660e with the package installed, including 6/6 repeats under CPU load.
On ba2a660e with the package moved aside, it fails with `Received string:
"unknown"` at the reported assertion.

Fix: the guard in `web/tests/host-build.ts` from the sibling issue's commit
makes browser global setup refuse to start without the package, so this
failure can no longer pass for a product regression.

## Decisions for later review

- The spec keeps rejecting `unknown`. Allowing it would hide a real regression
  in the native credential read.
