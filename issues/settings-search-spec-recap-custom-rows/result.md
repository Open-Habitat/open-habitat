# Result

Not a product or spec fault, and no commit turned the spec red. The reporting
runs lacked `internal/daemon/pi-device-test/node_modules`, the pinned Pi SDK
that the synthetic host (`test/browser-host/main.go`) uses for
`/api/v1/pi/recap-settings` writes. Clicking Oma shows the custom rows
optimistically, the PUT fails, and the section falls back to the stored
standard level, so the `recap-messages` row disappears.

Evidence (Birch, `OH_PORT_BASE=8000`, 2 workers):

- Passes on current main (bb321d64) and on ba2a660e when the fixture package
  is installed. It also passes 6/6 repeats with 10 busy-loop processes
  (load ~12 on 8 vCPU), which rules out timing under load.
- On ba2a660e, with `pi-device-test/node_modules` moved aside, this spec fails
  with exactly the reported symptom, and `browser-conversation-spec-openai-credential-unknown`
  fails with its symptom in the same run.

Fix: `web/tests/host-build.ts` (global setup of the browser and lab configs)
refuses to start when the Pi SDK entry is missing and prints the install
command. TESTING.md now says that every host-backed browser run needs the
package. The clean gate already installs it, so only focused runs were
affected. No bisect was needed because no commit was responsible.

## Decisions for later review

- Guard in global setup, not in the browser host binary. The alternative was
  to make `test/browser-host` exit at startup. Global setup fails once, with an
  actionable message, before any Chromium or host starts. Every config that
  starts a host (`playwright.config.ts` and `playwright.lab.config.ts`) shares
  it.
- No KOKEILTAVAA line, because nothing changes on an installation.
