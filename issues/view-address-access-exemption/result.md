# Result

Implemented the approved narrow Access-pin exemption: GET/HEAD of a currently public entry redirects directly; a matching public content host/token serves only its frozen export. Neither route admits requests to the app mux or owner-session handler. Private, unknown, expired, denied, deleted, disabled and faulted addresses remain behind the pin. Owner frames, API, login, robots.txt and other paths are not exempt. Existing health probes are unchanged. Operations guide and ADR 0035 now separate Habitat's pin from upstream ingress policy.

## Verification

Tested the implementation diff on base `e5ef8397c2f684d081f20f9386b1c9750b77cbea` (the fixing commit carries the exact tested source):

- `./scripts/test-focused.sh --area go --go-package ./internal/gateway`: passed, race enabled. New `TestAccessPinExemptsOnlyPublicViewReads` drives the production router with the pin enabled and asserts public GET/HEAD success, private/non-view refusals even with owner cookies, forbidden methods/body/upgrade/TLS cases, traversal refusals and all publication-ending states.
- `npm ci --prefix web` and `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`: passed (existing dependency audit/peer warnings).
- `./scripts/test-focused.sh --area web`: passed, 163 files / 1199 tests, lint and types.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=10370 ./scripts/test-focused.sh --area browser --spec view-links.spec.ts`: 2 passed, host-backed synthetic browser evidence. This is existing entry/owner/public journey regression coverage, not browser Access-policy evidence.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, `git diff --check`: passed; doctor lists existing image-format advisories.
- Independent critical `/llm-review`: claude-fable-5-1 finder and gpt-6-astra verifier, explicit adversarial private/non-view boundary check. No defect candidates. `/assess-findings`: zero actions. Local review inspected exact host dispatch, token comparison, publication recheck and fixed export relay. Review/assessment scratch lives under `history/`; model scores logged to Alder's corpus.

## Decisions for later review

No additional product or authority decisions. `/robots.txt` stays protected rather than widening the authorized token-bearing content exemption. Publication revocation retains the existing in-flight-read limit: a read already authorized may finish; it never becomes owner-session access.

## Limits

No real ingress, separate-UID or installed-server acceptance claimed; the end-to-end issue owns live ingress checks. No contracts or web source changed. Full clean gate and whole browser suite deliberately not run.
