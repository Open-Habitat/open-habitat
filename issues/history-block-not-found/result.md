# Result

The block lookup was correct. The CLI requests `limit_bytes=262144`, while the
text chunk helper rejected any limit above 65536, returning the same false
`resource_not_found` as an absent block. Both HTTP routes use that helper.
Text now treats the requested limit as a ceiling and clamps its response to
65536 bytes, preserving the existing response contract and continuation offsets.
The endpoint still rejects requests above its 1 MiB budget.

The browser uses 65536 for text and 1 MiB for images: its normal text reads were
not affected. Larger direct text requests on its daemon route were affected.
No browser, CLI, gateway, contract or authorization changes are needed.

## Reproduction and coverage

`TestNativeHistoryBlockClientBudgets` seeds synthetic native history using the
pinned Pi SDK's SessionManager (user then assistant flush, followed by bash),
serves the production owner-only agent listener and browser daemon history
handler, and uses entry IDs and revision from the history list. Before the fix:
agent 256 KiB and browser-route 1 MiB requests returned 404 for the exposed user
block; browser 64 KiB passed (`/var/tmp/history-block-repro-both.log`).

The regression checks short user/assistant/command text, exact reconstruction
of 1.2 MB UTF-8 bash output through continuation offsets, the text response cap,
stale revisions and over-budget refusal on each route. Browser authorization is
a synthetic trusted seam; it does not establish distinct-UID or live-gateway
isolation. Existing package tests retain hidden/redacted/unknown-block, image,
UTF-8 boundary and branch/revision coverage.

## Focused self-review

Reviewed the changed helper against `history.schema.json`, both client request
builders, CLI export continuation and the shared handler's validation. This
caught and removed an initial approach that would have enlarged text responses
past the contract limit. Final fix changes no block-selection/privacy logic,
only the interpretation of a valid requested ceiling. The local change does
not need a broader independent architecture review.

## Validation

Tested code: base `ab5003db335f17a68a173b4b19dd8ea0c829ef07` plus this issue's
helper change and native regression (the closing commit carries those exact
sources).

- `TMPDIR=/var/tmp go test -race -count=1 ./internal/daemon ./internal/cli ./internal/gateway`: PASS, **128.73 s** wall; daemon 118.041 s, CLI 8.325 s, gateway 9.516 s. Includes the final native regression.
- `cd web && npx playwright test tests/native-history.spec.ts --grep 'native page, continuation'`: PASS, **5.53 s** wall / 4.0 s Playwright, one directly affected host-backed Chromium case (Fleetrepo-routed to Cedar).
- `./scripts/test-focused.sh --area contracts`: PASS, generated contract drift clean and 63 schemas / 65 fixtures / 39 scenarios / 17 negative checks valid.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`: PASS (doctor has existing non-blocking attachment advisories).
- No web source changes, so no fast web suite; no full gate per brief.

 No live-server
content was read and no release was deployed by this worker; live CLI inline /
export acceptance remains for the conductor after deployment. No KOKEILTAVAA
entry is added for an undeployed change.

Failure inventory: the two pre-fix regression runs intentionally failed; the
first also exposed a test fixture Host-header omission, corrected before the
second reproduction. Optional diagnostic guesses for a nonexistent content
source file and an absent node_modules directory failed; scoped symbol lookup
found the actual helper and the declared fixture dependency install succeeded.
An intermediate race run was stopped after self-review changed runnable code;
only the final rerun is acceptance evidence. Logs are under
`/var/tmp/history-block-*`; no unresolved required failure is waived.
