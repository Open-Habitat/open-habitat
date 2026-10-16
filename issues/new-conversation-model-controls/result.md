# Empty-conversation model controls

## Fix

The composer now uses direction 1's compact rounded pill and an upward popover (a bounded scrolling sheet on phones). Opening the picker no longer expands the composer. The menu escapes the composer's draft-scroll clipping; desktop browser testing caught and verified that additional layout defect. Its chevron uses the bundled SVG icon, not a glyph missing from the font.

An empty conversation's top bar is informational. It uses the same short model identifier as the pill, from the running child's native settings, without the provider prefix. Native history takes precedence once available. The controller reads the child's native `get_state` before admitting its first send and retains that observation in its existing per-child startup field. A later settings/SSH global-default change cannot relabel that already-running empty session. Unknown native state is labelled unknown, not guessed from a cached global default.

“Valitse” keeps the choice and unsent draft in this conversation, without a create request, replacement child, close request or navigation. The choice is transient browser intent until the first send. That send passes `first_choice` to the existing controller. The daemon validates Pi's catalog, reserves the child's pending state, checks that no browser command or native conversation content has preceded it, and applies Pi 1.3's correlated non-persisting `set_model` / `set_thinking_level` RPCs before the prompt. A failed or uncertain setter prevents the prompt and leaves control uncertain; nothing is replayed. Used conversations retain the existing explicit-new-conversation fallback.

Pi remains the source of models, settings and history. The authenticated tab preloads one schema-validated catalog into identity-scoped React memory. Pickers reuse its rows while refreshing; focus and a one-minute timer also refresh it. A confirmed default write cannot be overwritten by an older catalog read. Identity changes abort reads and discard the old catalog. There is no browser-storage catalog, host cache, new registry or credential access.

## Reproduction and regression evidence

The synthetic lab at `OH_PORT_BASE=27800` reproduced the rectangular control, inline expansion, “Pi:n oletus” fallback, full provider-prefixed startup label and replacement-session action. I did **not** reproduce the exact live “conversation does not exist” message. Its empty-session create/close/navigation path is no longer invoked by this control, and the regression asserts a stable URL, preserved draft, one controlled session, and the selected native model after sending and reloading.

The two new desktop/phone browser journeys also hold a background model read indefinitely while opening the picker: cached radio rows must be usable within one second, with no loading placeholder. They assert a compact pill, panel viewport bounds, Axe checks of the affected interaction, focus return, “Valitse”, unchanged native default and stable short labels. These fail against the original control/semantics. The old four-replacement capacity test was replaced: this interaction no longer creates replacement children, and the new test directly asserts one child. Existing close-empty/controller tests still cover actual cleanup.

Unit tests cover catalog single-flight, retained rows, delayed old-identity responses, delayed reads racing a confirmed default save, and a refused applied model remaining blocked until the new choice is confirmed. Daemon tests reject first-choice writes for used, working, previously-commanded and question-blocked sessions. Native emptiness verification checks every branch, including user content off the active branch.

The pinned **real Pi 1.3** synthetic-provider test now launches one model, applies a different first-message choice to the same child, sends a prompt, reads the selected model/thinking from Pi's saved history, and verifies byte-identical global settings. It passes without a real account or provider. Synthetic browser fixtures are not live-provider evidence or distinct-UID evidence.

## Checks

- Fast web checks: **134 app tests + 119 component tests**, formatting, lint and TypeScript passed during development.
- Focused host-backed browser selection: **7/7 passed** (desktop/phone model controls, pre-start choice, warm return, unsupported-model recovery, native-default settings and refusal/fallback).
- `TMPDIR=/var/tmp go test -race -count=1 ./internal/daemon ./internal/contracts`: passed, including the installed pinned-native-Pi test dependency.
- Contract regeneration/drift and schema/example validation: passed; the optional first-send intent is documented in `pi-message.schema.json` and HTTP API docs.
- Project-view validator and `git diff --check`: passed.

Final rebased-tree gate evidence is recorded below after completion. Earlier test setup failures (missing dependencies, omitted synthetic write Origin, capturing the route before creation finished) were corrected, not counted as passes. One initial full-unit run exposed a selection-initialization race; initializing preloaded controls before paint fixed it and the full fast checks passed afterwards.

## Visual evidence

`visual/` contains paired AVIF/static offline HTML from the loopback synthetic lab: before/after empty, picker and selected states at **1440×900 and 390×900**, plus the phone action area and light/dark post-reply/reload states. Before captures used the fixture's unset default; final after captures configure the synthetic native default to `gpt-6.1-sol · high`, then choose Nova. This deliberately demonstrates the known-default label rather than pretending the fixture's unset default identifies a real model. The original reporter images remain untouched.

I compared the production pill, upward menu, phone sheet, rows and thinking controls with `design-system/prototypes/rounds/2026-10-16-mallit/round.js` and `round.css`, direction 1. The panel scrolls to its actions rather than claiming all native candidates fit on a phone. Screenshots are review evidence, not automated pixel comparisons. No live data or personal browser profile was captured.

## Live checks

`KOKEILTAVAA.md` has desktop/phone checks for the initial short name, immediate cached opening, same-conversation “Valitse”, preserved draft/URL, first reply/reload and unchanged SSH Pi default. No signed-in live-server or real-account entitlement check is claimed here.

## Full gate and integrated follow-up

`OH_PORT_BASE=27800 OH_BROWSER_WORKERS=2 TMPDIR=/var/tmp ./scripts/ci-local.sh --clean --json` was run on `55984b922c7ceae6343e627bb4de8baaceb6f455`, tree `2496de27aed0ed03f37d762487c7165dce93bf6f`. **It did not pass and produced no clean-gate receipt.** The first attempt had stopped on a test-only unsupported Testing Library option; that was corrected before this attempt.

The 511-second attempt passed the seven pinned-SDK tests, formatting/lint/TypeScript, 134 app tests, 119 component tests and Storybook. Normal browsers: **173 passed, two opt-in captures skipped, three failures**. Both new model-control journeys passed. The failures were continuation recovery waiting for its button, archive-notice expiry, and home cloning unable to bind port 27840. Go passed the daemon (including the new native model path) but failed `TestConversationGatewaySessionBoundary` with a synthetic abort route returning 503. The subsequent lab, packaging and final receipt stages were not completed. Logs are retained locally as `/var/tmp/model-controls-gate-55984b92.{stdout,stderr}.log`.

Isolation after rebasing onto `e39e16e1`:

- Gateway boundary: five race-enabled runs passed.
- Continuation recovery, home clone and five affected model/settings journeys passed with one browser worker.
- Port 27840 belonged to PID 854738, a synthetic host left since September 29 in a **deleted** `wt-b12dbz20jv-pi-working-experience` worktree. Its command/cwd established that ownership before I stopped just that disposable host; no household service was touched.
- Archive expiry still failed in isolation. Temporarily substituting the changed production web files with their exact `main` versions made it pass, then the worker files were restored byte-for-byte. This was investigated rather than labelled an unrelated timeout without evidence.

The final focused checks and archive-clock investigation are recorded below. Per `TESTING.md`, a failed full gate is not represented as a pass or a production-release receipt; landing still requires the affected checks.

The archive case was investigated as a clock/scheduling problem. Moving clock
installation before React initialization and using `runFor` passed once with one
worker, but failed again with two workers. That experiment did **not** establish
a complete fix and the original expiry test was restored. No production archive
code was changed. The model journeys now independently assert that the pill's
corner radius is at least half its height, not merely that its rectangle is small.

The experimental expiry case and both model-control cases passed together once (**3/3**); the complete synthetic lab suite then passed **24/24**. The lab manual host was stopped after captures. Rebased fast web checks and contract validators also passed. The failed gate remains explicitly failed: no clean receipt is claimed, and its infrastructure/scheduling failures are not all described as timeout-only flakes.

A real-clock control run of the existing expiry journey (no fake-clock installation or jump, 11-second assertion deadline), repeated three times, passed **3/3**. The temporary test variant was restored afterwards. This independently checks actual expiry while retaining the original test for its owning `implement-conversation-details` work; the inconsistent fake-clock assertion remains a gate-health follow-up, not a claimed production timer fix.

Self-review also caught and fixed a genuine remaining model-label defect: an empty running child could have been relabelled from a later global default. Creation now waits for that child's correlated native `get_state` before admitting a send, retaining only its bounded model/thinking observation in the existing startup field. A browser regression changes the native default after starting an empty Sol session, reloads, sends and reloads again: the session stays Sol while the default remains Nova. The pinned real-Pi test additionally verifies the initial native state reply. Full race-enabled daemon/gateway/contracts tests and seven focused model/settings/recovery browser cases pass with this stronger source-of-truth fix.

## Scoped result before workspace integration

Pre-workspace runnable commit: `30e65bccee1653777123962bd19cfe1ad72071b0` (tree `1e4a3b9b77cf94a103fea4caa99cbf343c48655a`), rebased onto current `main` including the settings, thinking-title and open-at-latest work. Final checks:

- Fast web: **136 app + 126 component tests**, formatting, lint and TypeScript passed.
- Focused host-backed model/settings/recovery browsers: **7/7 passed**.
- Full synthetic lab after the final UI changes: **27/27 passed**.
- Race-enabled daemon/gateway/contracts packages passed after the native startup-observation change; their runnable source is unchanged by the final UI-only fixes.
- Contract drift/schema examples, project-view validator and whitespace checks passed.

A final focused run exposed another genuine picker race: late native history could change the applied label from provider-qualified to bare, resetting an unconfirmed radio choice. Staged edits now survive native/catalog refreshes, while disclosures are keyed by conversation so those edits cannot migrate to another conversation. A unit regression independently exercises that late-prop update. Once the first send begins, the composer no longer offers or resubmits a first-model intent; the browser regression checks the pill disappears then.

The combined-SSE lab journey also now waits for creation's asynchronous navigation before reading its reference snapshot/cursor. Creation publishes one ready-state invalidation after observing Pi, not an unnecessary intermediate model update. Its provisional/delta/replay assertions remain intact and the complete lab passes.

The full gate remains **failed**, as detailed above, with no receipt or production-release claim. The real-clock archive control passed three repetitions; the original fake-clock case is left unchanged for the existing conversation-details work. This is not described as a timeout-only clean-gate exception. Landing follows `TESTING.md`'s affected-check policy.

Closing uses exact run `01m51sh2vsbcs2v4r1z02ej8yj`. A teardown-safe one-shot user unit performs `/worktree-merge` and the required fetch/rebase/non-force main push, boundedly waiting for unrelated main-worktree edits without touching them. Its log is `/var/tmp/model-controls-finish-01m51sh2vsbcs2v4r1z02ej8yj.log`; a successful push writes `/var/tmp/model-controls-finished-01m51sh2vsbcs2v4r1z02ej8yj.json`. The existing test-release watcher was observed active. Signed-in live checks remain with Jari; no deployment receipt is claimed by these synthetic tests.

## Workspace-page integration and landing validation

The workspace-page work landed immediately before closing. I rebased rather than
reverting its new flow. Conflicts in `App.tsx` and `PiModelSelector.tsx` were
resolved by retaining the new workspace page, identity-fenced `createTracked`
path, fresh native refusal/unavailability admission checks and archive-focus
handling, while keeping the identity-scoped picker cache. Its `loadPiModels`
export remains available on the shared schema-validating reader; admission still
requests a fresh native observation rather than trusting cached eligibility.
The Git and Pi-message schemas/examples were both retained and generated Go/TS
fingerprints regenerated from their union. Both sides of the creation/cleanup
fences remain in `ConversationActions.tsx`.

The only browser-journey adaptation is to choose a per-session model in the
newly created empty composer: the new workspace page no longer presents the old
pre-start picker. The existing conversation-details worker's archive-focus and
clock-test changes were preserved, not replaced by this worker's unsuccessful
clock experiment. No feature commit was dropped. `git range-diff` was checked;
the final rebase onto `18d3b2dc` changed only other issues/docs, with **no runnable
file changes** relative to the tested integration commit below.

Tested integration commit: `be137fdae2926b7e03b2ab1a4bdd57cf8fe66d43`, tree
`cd69880cf6a7ab879db3e89349192a5545a7774c`:

- Fast web: **137 app + 126 component tests**, formatting/lint/TypeScript passed.
- Contract drift and validation: **37 schemas, 23 examples**, passed.
- Focused browser selection: **9/9 passed**, including all model regressions,
  native defaults, unsupported-model recovery, warm return and the original
  archive expiry check with the owning worker's integration fixes.
- Complete synthetic lab, including the new workspace page: **31/31 passed**.
- Full daemon/gateway/contracts package race tests: passed.

The earlier failed full gate is still not a clean-gate receipt for this newer
integrated tree. All affected checks pass; live account/provider and SSH checks
remain explicitly unverified in `KOKEILTAVAA.md`.

Equivalent rebased landing runtime is present at `56065384` on top of `18d3b2dc`; comparison with the tested integration commit found no changes under `web/src`, `web/tests`, `internal`, `contracts`, `test` or `scripts`. Subsequent changes are closing documentation only.

## Reopened placement fix — 2026-10-16

Jari's `pilleri-kentan-alla.png` was reproduced in the synthetic lab at `OH_PORT_BASE=28200`: the pill was a sibling below the editor and the editor alone owned its border/focus outline. Direction 1's prototype appends `.md-cbar` **inside** `.cbox`; the production implementation now follows that structure. A shared composer input surface contains the text area and padded model row. Its border and `:focus-within` outline enclose both, while the inner text area has no separate border/outline. The send button remains outside. Existing upward desktop popover/phone sheet and focus return are retained. Without a model picker the editor retains its original styling.

Extended the existing desktop/phone `@model-controls empty choice` journeys rather than adding duplicate host journeys. They assert pill containment on all sides, placement below the editable text, viewport bounds, a bordered shared surface with a visible outline on editor focus and pill keyboard focus, and no competing editor outline. Existing assertions still exercise the picker bounds, Axe, selection, draft/URL preservation, native choice and first-send disappearance. Both widths **failed against unchanged production code** on containment, then passed with the fix.

Evidence: `visual/pill-before-{1440,390}-focused.{avif,html}` and `visual/pill-after-{1440,390}-{focused,picker}.{avif,html}`. These are synthetic lab captures, not live-server evidence or automated pixel comparisons. Reviewed the focused images against direction 1's composer markup/CSS and the reporter's screenshot. An initial narrow capture could not reach the collapsed sidebar; the capture now navigates at desktop width before resizing. A subsequent capture exhausted the manual lab's child capacity; resetting disposable conversations between captures fixed the setup. Neither capture failure is counted as a product-test pass.

Validation before the full gate:

- `OH_PORT_BASE=28200 OH_BROWSER_WORKERS=2 TMPDIR=/var/tmp PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/.cache/ms-playwright npm run test:e2e --prefix web -- --grep '@model-controls|@browser-conversation.*(composer|working|queue)|@conversation-details'`: **10/10 passed** (19.2 s).
- `./scripts/test-web-fast.sh`: formatting, lint, TypeScript, **137 app + 126 component tests passed**.
- `python3 scripts/validate-project-view.py` and `git diff --check`: passed.
- Focused self-review: only the production Composer layout/CSS and existing model-control journeys change; no model state, native authority, contracts or extension-message rendering changed. The common surface does not clip the popover; the existing open-picker overflow escape remains intact.

The full gate runs on the committed fix below; its final result is recorded separately. Memory was checked with `free -g` before building and before the gate. Live desktop/phone focus/placement checks are in `KOKEILTAVAA.md` and remain unverified on the signed-in test server.
