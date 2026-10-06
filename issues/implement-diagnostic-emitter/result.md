# Diagnostic emitter result

Implementation: `83675a83e88d39a02738a7022df8534de6fda653` (clean gate product tree). The host-owned gateway, broker and service lifecycle records now share a small `slog` JSONL convention; classified service errors replace CLI startup error text, and the deployment guide names the three journals and field meanings. No protocol, browser or authorization boundary was changed. The broker-verified Unix name appears only on a successful login, never from the callback's claimed identity.

## Evidence

- `go test ./internal/gateway ./internal/provision ./internal/cli ./internal/diagnostic` passed. Existing callback tests exercise classified broker failures, failed diagnostic writes and synthetic credentials/work-content exclusions; new tests check the envelope, a failed sink, and a service startup error containing a synthetic secret marker. A failing writer returns immediately in these tests; they do not prove that a blocked stderr cannot stall the service.
- `python3 scripts/validate-project-view.py` passed (25 pages); `git diff --check` passed.
- `TMPDIR=/var/tmp/nah-diagnostic-emitter PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright NAH_PORT_BASE=16240 ./scripts/ci-local.sh --clean --json` passed on committed revision `83675a83e88d39a02738a7022df8534de6fda653`; final JSON reports `status: passed, clean: true`. Go packages, generated contracts, packaging, 136 browser cases and 16 lab cases passed. The VM self-test reported `fixture-valid` and `launched: false` (not a boot proof). No live journals or distinct-UID journal permissions were tested. The gate emitted ordinary dependency/build warnings (npm audit reported two web dependency advisories on one install; PostCSS/large-chunk warnings); they did not interrupt checks.

## Decisions for review

- Use synchronous `slog` JSONHandler with a shared envelope helper and explicit fixed classifications at call sites. Ignore prompt write errors; do not add the withdrawn async queue or pretend a blocked journal stream cannot delay a caller.
- Record `service_ready` on successful startup even without `--verbose`, without listening address or configuration path. Log a classified `service_failed` for service `exec` instead of printing an arbitrary raw error; the CLI's non-service commands retain their existing error contract.
- Keep broker `GuardEvent`'s fixed stages as `reason`, and log only the broker-verified Unix username on a completed gateway login. Do not extend attempt IDs to the broker or daemon.

## Review and remaining limits

Focused self-review of the final diff was proportionate: the change alters log formatting and startup error presentation, not who can authenticate or the broker's result. I checked each added field's source and the absence of error/request serialization; the focused tests and clean gate supply independent execution evidence. No external model review was run. The Go HTTP server's own TLS handshake messages (seen in the synthetic browser run) are library output, not host-owned JSONL records. The later @correlate-diagnostics issue owns missing operational-path records. The final deployment must install the release through Fleetrepo and verify the actual systemd unit names, journal access/isolation and retention on the test guest; this worker did not deploy.
