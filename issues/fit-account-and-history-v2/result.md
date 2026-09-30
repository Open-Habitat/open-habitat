# Account and return-view fit — synthetic evidence

This changes presentation only. Account settings now group Tili, Yhteydet tällä palvelimella, Ulkoasu and Istunto, using the existing GitHub state and theme controls. The return list preserves native-history routing and shows a running mark only for positively observed live processes from a fresh snapshot. There is no OpenAI connection row because the validated snapshot contains no such status; the request is in `item.md`.

Eight paired synthetic lab screenshots and inert HTML snapshots are listed in `item.md`. The fixtures have invented identities, repos and conversations; no live provider, Unix-UID isolation or real user account was tested. The screenshots exercise both themes, desktop and 390 px. The connected/running mark is covered by fixture stories and component tests rather than a fabricated lab state.

Development checks (30 Sep 2026): `./scripts/test-web-fast.sh` passed (11 unit and 62 component tests), and `NAH_PORT_BASE=21000 npm run test:browser --prefix web -- --grep '@account-settings|@workspace-slice home|@a11y.*account'` passed 5 browser cases against the synthetic host. An earlier browser attempt timed out when clicking a visually hidden radio `<input>` in the new test; the test now clicks the visible label, and the rerun passed. `npm ci --prefix web --offline` installed the locked graph after the initial typecheck failed for missing `tsc`.

Final committed-candidate gate and issue validation receipts follow after review.
