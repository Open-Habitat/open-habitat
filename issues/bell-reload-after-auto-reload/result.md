# Investigation result — not reproduced; issue remains open

Base: `4f135603b417569e3c3a0e46992dc243d95b529f`.
Run: `01m6txg5brcgd1b2fk1khz7e6v`.

The synthetic browser host does **not** reproduce a second reload requirement.
Both the bell's reload and the browser's ordinary reload load release 1 after
one document navigation, preserve the conversation draft, report the bundle
as current, and leave no bell. No production code was changed and this is not
a claim that Jari's live occurrence was fixed.

## What was established

- Reconnection is not an automatic page reload. With an open conversation,
  hold the event endpoint unavailable, observe the connection bar, upgrade the
  gateway, then restore networking: the bar disappears, but there are zero
  document navigations and the script still names the old bundle. The version
  item correctly remains. This explains the automatic-recovery interpretation
  of the report, but not a confirmed manual reload that left the item behind.
- After either actual reload, the document names `?release=1`, the application
  is running and its draft is restored. Its document response has
  `Cache-Control: no-store`. The running gateway reports `0.0.0-lab.1` and the
  same document's bundle comparison reports `current`.
- `internal/gateway/server.go` serves the shell routes and index with
  `Cache-Control: no-store`. `bundleRelease.ts` fetches the comparison index
  with `cache: no-store`; its state and captured own key are module-local,
  not persisted across document loads. No service-worker registration was
  found in `web/src` or `web/public`.
- The former regression used `page.goto('/settings')` after the first reload:
  it inadvertently loaded another document before checking `current` and the
  absence of a bell. The strengthened test uses in-app administration
  navigation and verifies unchanged `performance.timeOrigin`, then returns
  to the conversation and checks the bell there.

The fixture changes asset references but uses the same compiled code for both
releases. It proves the browser/gateway interaction, not two historical release
builds, Cloudflare behavior, or the live browser's cache. A stale live response,
concurrent second deployment, or a real manual-reload failure remains unverified.

## Checks and review

- Installed locked web dependencies and the Pi SDK fixture dependencies.
- `OH_PORT_BASE=17200 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec server-version-reload.spec.ts`: original three cases passed;
  strengthened final four cases passed (5.4 s Playwright run).
- `./scripts/test-focused.sh --area web`: static checks and 184 test files /
  1,389 tests passed. Final subsequent changes were confined to the Playwright
  spec and were formatted and rerun as above.
- Focused self-review: removed the second-document blind spot, asserted a
  positive bundle verdict before checking absence, distinguished reconnect
  from navigation, retained draft and incompatible-contract coverage. No
  production/session/contract/authority change requiring independent review.
- No full gate, live browser capture, deployment, or Go changes.

## Decisions for later review

Keep the existing reconnect behavior rather than adding an unsolicited document
reload. Alternative: force reload after recovery whenever a new bundle exists.
That would change product behavior and could discard in-memory editor work;
there is no reproduced bundle-comparison defect justifying it here.

Do not mark this bug fixed or attach a Fixes-Issue trailer to test-only work.
The original acceptance requires finding and fixing the manual-reload cause,
which this investigation has not established. Preserve the test and evidence
for the conductor rather than inventing a cache workaround.

## Next discriminating observation

On the next live occurrence, distinguish a real document reload from recovery
and record the old/new module script URL plus the freshly fetched shell's module
URL, shell cache headers, and server release. If one manual document reload
leaves the same version item, those three values separate stale shell delivery
from a false bundle mismatch without inspecting personal conversation content.
