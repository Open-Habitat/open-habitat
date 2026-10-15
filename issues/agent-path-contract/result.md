# Result

The per-user daemon passes the bound account's agent command path to browser-started Pi (including continuation and saved-history title updates). Host-managed GitHub and Git commands retain absolute programs and restricted environments. A synthetic subprocess test checks the actual launch environment, precedence, inherited child discovery and two distinct fixture homes. The only production uses of `agentPath` are the per-UID daemon's three Pi launch sites; gateway and broker never call it, and the broker's own subprocess environment remains fixed. The test cannot establish cross-UID isolation: that depends on account binding validation and Linux permissions; a test-server journey should verify the real SSH shell ordering and a second mapped UID before claiming live parity.

## Verification

- Targeted daemon subprocess tests, transport package tests, and the browser lab `browser Pi resolves the user's own executable` case passed.
- The full focused daemon package run failed in existing process-observation tests (`TestPiWriterLiveOwnUID`, `TestCloseEmptyBrowserChild`, others): other same-UID fake Pi/browser-host workers remain on this shared server and can make the conservative writer scan return `unknown`. The dedicated PATH tests passed. Log: `/var/tmp/agent-path-focused.log` (local only).

## Decisions for later review

- The daemon does not source login shell profiles. Operators align SSH login shell PATH with the documented order; the host cannot guarantee shell parity for independently customized profiles.
- The synthetic two-home test runs under one UID, so it proves path construction and non-inheritance, not kernel-enforced cross-UID isolation. A live two-UID check remains necessary for deployment.
