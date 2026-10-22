# Sign-in failures: investigation and verified changes

## Evidence and limits

Read the real test guest's `open-habitat-daemon@maintainer` journal for
2026-10-22 05:32–05:42 UTC over pinned SSH. Microsoft starts occurred at
05:32:52 and 05:35:07; Dropbox started at 05:35:53, followed by two PUTs at
05:37:15 and 05:38:08, and cancellation at 05:41:28. The journal has HTTP
routes/status/timings, **not the native failure phase or provider response**.
The Microsoft pending cache and Dropbox config/listings were absent when
inspected after cancellation. Existing screenshots were viewed locally, not
published or committed. No live login, token read, cloud write, service restart
or deployment was performed by this worker.

Dropbox's screenshot is reproducible from the relay's `completing` state
**after folder choice**, while `ChooseFolders` waits for the first native
rclone bisync pass. The UI reused its login spinner and reset its stepper to
step one. That is not evidence that rclone itself was hung: a first copy can
legitimately take a long time. The historical native operation's progress is
not recoverable from those logs.

Jari's later observation is explained by the app's close handler: backdrop
click calls close, which sends cancellation. The relay then removes a **new,
unfinished** native connection. Consequently it disappears from the list, whose
truth is the native config, not a second registry. Already copied files remain.
Explicit cancellation retains this behavior; accidental dismissal no longer
invokes it. Existing relay cancellation tests cover account cleanup and races
with sync completion.

Microsoft's scope check rejected resource-qualified Graph grants, accepting
only bare `User.Read`/`Files.ReadWrite.All`. It now recognizes the exact
`https://graph.microsoft.com/` namespace as well, without accepting another
resource's permission. A regression exercises the complete first grant,
Graph discovery and hand-off to Softeria; another-resource grant is rejected.
The prior implementation fails that regression. This is a verified protocol
bug, **not proof that it was the cause of Jari's two historical failures**.

Read the pinned guest Softeria 0.170.1 sources: comma-separated presets,
whitespace-separated allowed scopes, account-pin environment, encrypted-cache
filenames and one-line success JSON match the adapter. No need to change its
native cache or imitate MSAL storage. Redacted `integration_login` diagnostics
now identify device-token, Graph identity/discovery, Outlook login/identity, or
native-commit failure, with only fixed phase/reason/provider values. A regression
checks that native error text does not enter those diagnostics.

The conductor explicitly authorized landing these tested improvements with the
historical Microsoft cause unresolved. The conductor will push, request a live
retry and ask whether one or two codes were approved and which account kind was
used. Closing this implementation is not a claim that live Microsoft acceptance
has passed.

## Decisions for later review

- Keep explicit cancellation destructive for a new unfinished connection,
  rather than leave an authorized but uninitialized account unexpectedly present.
  Disable backdrop and Escape dismissal throughout an active OAuth flow. During
  the first sync, omit the ambiguous header X and offer only the clearly named
  cancellation button. Other login phases retain deliberate close/cancel
  controls. The alternative is hiding/resuming rather
  than cancelling, which would require a distinct user-facing action.
- Reuse `completing` plus the account address to distinguish initial sync in the
  browser. The relay publishes that address during `completing` only after a
  folder choice, using its transient attempt phase: a renewal already knows its
  address before the redirect exchange, which is not a native file sync. This
  also handles a renewal of an existing but uninitialized sync and survives a
  browser reload. No new login state, provider credential, store, gateway
  authority, or contract field is needed.
- Dropbox URL copying remains for now. The current PKCE flow registers a
  loopback redirect on the browser's machine; neither rclone's remote listener
  nor the daemon can receive that browser-local callback. Dropbox supports
  registered HTTPS redirects, so a same-origin static callback page could
  return code/state to the opener, with the daemon retaining state/PKCE and
  identity validation. This needs a registered redirect/configuration change,
  browser callback handling, strict origin/attempt checks, secret-free access
  logging, and replacing the present loopback-only redirect rule. It is not a
  contained rclone flag change; do not add a public gateway OAuth authority or
  pretend a server-local loopback listener solves browser-local callback delivery.

## Validation

Final runnable source is commit `57c696d7` (subsequent edits are issue evidence
and the Finnish trial entry only). All build scratch used disk-backed
`/var/tmp`; native credential tests ran under `umask 077`. No full gate and no push.

- `npm ci --prefix web` and Pi SDK fixture install: passed.
- Final `go test -race -count=1 ./internal/daemon/integrations ./internal/daemon`:
  passed (12.069 s / 152.095 s), including the reviewed renewal-phase repair.
  Earlier non-race package/caller and integration race runs also passed.
- Overlaying the pre-fix Microsoft implementation while retaining the new
  regression: expected failure `valid Graph grant did not reach Outlook login`.
- `./scripts/test-focused.sh --area web`: passed static checks and 488 tests.
- `./scripts/test-focused.sh --area contracts`: passed generated drift,
  62 schemas, 67 fixture files, 40 scenarios and 17 negative checks.
- `./scripts/test-focused.sh --area browser --spec integrations.spec.ts`:
  all six journeys passed (15.6 s) through Cedar's warm Linux runner,
  including desktop/phone axe. The extended folder journey holds an initial-sync
  observation, checks step two and rejects backdrop/Escape dismissal, then
  observes completion. Explicit close still exercises real relay cancellation.
  An earlier run failed the old Escape-means-cancel assertion, updated to
  deliberate close to preserve that cleanup proof. The reviewed intermediate
  guard failed the new X-absence assertion; the exact-header correction then
  passed all six journeys. The final capture also uses that corrected code.
- Synthetic lab capture: one focused journey passed (12.3 s). Adjacent
  `evidence/initial-sync.avif` and inert HTML show the shared initial-sync UI
  with invented Microsoft data; not a real Dropbox account or transfer.
- Explicit `go test -v` skip inspection confirmed the optional real-rclone
  bisync/OAuth-secret and real-Himalaya tests did not run: no `OH_TEST_RCLONE`
  or `OH_TEST_HIMALAYA` was selected. Native transfer behavior was not changed;
  no actual-provider/native-binary acceptance is inferred from fake tools.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
  `git diff --check`: passed; doctor retains existing unrelated image advisories.

Detailed transient logs: `/var/tmp/oh-signin/` on Alder. Browser evidence is
synthetic same-UID routing/UI evidence, not Linux isolation or live-provider
acceptance. Microsoft historical root cause and live acceptance remain open. The suggested
native Softeria log files (`~/.ms-365-mcp-server/logs/mcp-server.log` and
`error.log`) were also checked by existence/count-only filtering on the guest;
both were absent. No native log or provider error text was printed.

## Tool/sub-workflow failure inventory

- Browser attempts: the first run had five passes and an obsolete Escape-cancels
  assertion failure. That test now uses explicit close. A later reviewed edit
  guarded the wrong button, caught by both our browser run and the verifier.
  The actual-header guard then passed all six journeys. Logs:
  `browser.log`, `browser-reviewed.log`, `verifier.md` and the final
  `browser-reviewed-final.log` under `/var/tmp/oh-signin/`.
- Awaiting-input API: the initial payload's recommended default did not exactly
  match an option; a second payload exceeded the bounded topic limit and returned
  `corrupt_state` for the proposed seq-0 event. Neither corrupted persisted run
  state (`run show --current` confirmed this). A short, matching payload opened
  event 4, and the conductor's authorization resolved that exact event. An
  unsupported `taskfleet --version` probe was corrected to `taskfleet version`.
- Local Pillow cannot encode AVIF. The installed `avifenc` converted the captured
  PNG successfully; no image dependency or global binary was installed.
- Read-only discovery probes guessed a Softeria `args.js` path and old runner/bin
  locations that do not exist. The pinned `cli.js`, installed execution-runner
  instructions and normal command shims supplied the actual surfaces. Missing
  checkout-local npm dependencies were installed before tests. These were
  discovery failures, not missing acceptance checks.

The pre-fix regression failure is expected negative-control evidence, not a
failed deliverable. Transient artifacts are under `/var/tmp/oh-signin/`; no
provider response, token, personal cache or live screenshot is included.

## Proportionate review

Evidence-gated `/llm-review`, finder **claude-fable-5-1**, verifier
**gpt-6-astra**, two complete calls. Narrow high-risk boundary: Graph permission
namespace admission, secret-free diagnostics, and cancellation of a native
sync. No broad panel or repeated review loop. No model-performance write/push
under the worker's no-push policy.

Two concrete findings were confirmed and repaired: the ambiguous header X
still cancelled initial sync, and a renewal's known address misidentified its
redirect exchange as native sync. The first guard edit targeted a different
close button; both our focused browser regression and the verifier caught it.
It was moved to the actual header, with a final fresh browser run required.
The verifier refuted namespace-bypass and diagnostic-leak candidates, and
confirmed the daemon-derived renewal phase. Local assessment: both confirmed
findings are FIX; the historical Microsoft cause is UNABLE_TO_VERIFY, not a
new review issue. Local detailed review: `history/review-integration-signin-failures.md`.

The finder's exploratory native tests hit existing unsafe-home-path cases on
both its baseline and diff; those runs were not acceptance evidence. The
verifier's selected Go race tests and our own restrictive-umask package/caller
runs supply independent synthetic evidence. The verifier's failed intermediate
browser run likewise supplies defect evidence, not a passing test claim.

The tracker refused `done` because this is a bug; it was closed as `fixed`, its
required delivery status, instead of changing its type to bypass the rule.

## Integration

The first `run merge` rebased all runnable commits cleanly, then conflicted in
`KOKEILTAVAA.md`: main replaced the old Monaco checklist with CodeMirror/VS Code,
while this branch inserted the sign-in entry beside it. Resolution keeps main's
new editor entry and adds this sign-in entry, without restoring obsolete Monaco
instructions. No report was submitted by the failed merge; the same exact run
will retry after rebase validation.

Rebased verification on `cb6f4d37` (the integration source bytes match the tested
pre-rebase `57c696d7` exactly): fresh `npm ci`, focused web static checks and
489 tests passed; contract drift/validation passed 63 schemas, 68 fixture files,
40 scenarios and 17 negative checks; all six integration browser journeys
passed again (16.7 s), including axe. Logs: `/var/tmp/oh-signin/rebased-*.log`.
Fresh rebased `go test -race -count=1 ./internal/daemon/integrations
./internal/daemon` also passed. No required check remains incomplete.
