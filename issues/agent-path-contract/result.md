# Result

The per-user daemon passes the bound account's agent command path to browser-started Pi (including continuation and saved-history title updates). Host-managed GitHub and Git commands retain absolute programs and restricted environments. A synthetic subprocess test checks the actual launch environment, precedence, inherited child discovery and two distinct fixture homes. The only production uses of `agentPath` are the per-UID daemon's three Pi launch sites; gateway and broker never call it, and the broker's own subprocess environment remains fixed. The test cannot establish cross-UID isolation: that depends on account binding validation and Linux permissions; a test-server journey should verify the real SSH shell ordering and a second mapped UID before claiming live parity.

## Verification

- Targeted daemon subprocess tests, transport package tests, and the browser lab `browser Pi resolves the user's own executable` case passed.
- The focused daemon package run failed in existing process-observation tests (`TestPiWriterLiveOwnUID`, `TestCloseEmptyBrowserChild`, others): other same-UID fake Pi/browser-host workers remain on this shared server and can make the conservative writer scan return `unknown`. The dedicated PATH tests passed. Log: `/var/tmp/agent-path-focused.log` (local only).
- Full clean gate on `5a500559` (2026-10-15): web, Go/race, contracts, and all 158 standard browser tests passed; one of 25 lab cases, the existing `@lab real controller creates and persists a fake-Pi turn`, failed when Playwright could not read a navigated response (`Network.getResponseBody: No data found`). The requested isolated retry of that exact case passed (1/1). Logs: `/var/tmp/agent-path-gate2.log` and `/var/tmp/agent-path-flaky-retry.log` (local only). The full gate exit was 1 and produced no clean receipt; packaging was not reached. An earlier gate attempt stopped at a format error in the new lab case, fixed in `5a500559` (`/var/tmp/agent-path-gate.log`).

## Decisions for later review

- The daemon does not source login shell profiles. Operators align SSH login shell PATH with the documented order; the host cannot guarantee shell parity for independently customized profiles.
- The synthetic two-home test runs under one UID, so it proves path construction and non-inheritance, not kernel-enforced cross-UID isolation. A live two-UID check remains necessary for deployment.
