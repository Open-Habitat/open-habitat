# Account and return-view fit — synthetic evidence

This changes presentation only. Account settings now group Tili, Yhteydet tällä palvelimella, Ulkoasu and Istunto, using the existing GitHub state and theme controls. The return list preserves native-history routing and shows a running mark only for positively observed live processes from a fresh snapshot. There is no OpenAI connection row because the validated snapshot contains no such status; the request is in `item.md`.

Eight paired synthetic lab screenshots and inert HTML snapshots are listed in `item.md`. The fixtures have invented identities, repos and conversations; no live provider, Unix-UID isolation or real user account was tested. The screenshots exercise both themes, desktop and 390 px. The connected/running mark is covered by fixture stories and component tests rather than a fabricated lab state.

Development checks (30 Sep 2026): `./scripts/test-web-fast.sh` passed (11 unit and 62 component tests), and `NAH_PORT_BASE=21000 npm run test:browser --prefix web -- --grep '@account-settings|@workspace-slice home|@a11y.*account'` passed 5 browser cases against the synthetic host. An earlier browser attempt timed out when clicking a visually hidden radio `<input>` in the new test; the test now clicks the visible label, and the rerun passed. `npm ci --prefix web --offline` installed the locked graph after the initial typecheck failed for missing `tsc`.

Final committed-candidate gate and issue validation receipts follow after review.

Independent final-diff review by `claude-fable-5-1` identified two real browser-theme synchronization defects; both are fixed and covered by new component tests (shared subscription on the settings page and in-memory choice when storage is unavailable). The review and finding assessment are under ignored `history/review-fit-account-and-history-v2.md` and `history/assessment-fit-account-and-history-v2.{json,md}`; no follow-up issue was needed. Review level: one independent focused review plus local verification is proportionate to a view-level fit with no new host authority, credentials or contract; the tests and clean gate still provide the release check.

The first committed-candidate gate ran 99 browser cases successfully but exited 1 when a later browser phase tried to bind the already-running synthetic lab on `21001` (`healthz is already used`). The lab was stopped and the visual pairs refreshed against the corrected code before retry. That incomplete run is not counted as a gate pass.
