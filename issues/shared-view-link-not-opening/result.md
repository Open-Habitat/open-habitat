# Result: restart coverage added; reported failure not yet reproduced

No public-routing or capability change has been made. The existing browser
journey already publishes from the view card, copies its stable `/n/` address,
and opens it in a fresh signed-out browser context. It also checks unpublishing,
republishing and permanent deletion. That journey passes on this branch.

The added `view-links.spec.ts` persistence regression guard repeats the recipient
journey after a daemon listener/controller restart and after a synthetic gateway
release switch. Each recipient has a new
cookie-free context and loads the view's script, stylesheet and image. The
release-switch step observes the new gateway version before opening the link,
so the fixture's early acknowledgement cannot stand in for a completed restart.
This is same-UID synthetic evidence, not an installed upgrade qualification.
The daemon fixture reuses its stateless export HTTP handler; it does not start a
new OS daemon process. The gateway step reconstructs Auth from persisted state.

## Investigation

- Frozen exports live under the person's persistent view directory and are read
  from manifests, not an in-memory daemon inventory.
- Address state lives in the gateway's `view-links.json`, beside the session
  store. Gateway startup reloads the entry and content-host indexes from it.
  `TestViewAddressStoreRoundTripAndFaults` covers persistence and fail-closed
  handling of invalid state.
- `ResetLegacyViewLinks` resets only the old version-1 movable-link format.
  Current version-2 addresses and their secrets are left unchanged. The existing
  `TestViewAddressLegacyStoreWaitsForTheUpgrade` checks this distinction.
- A valid public `/n/` entry redirects without consulting an app session. Every
  content read still requires the matching capability, active publication,
  enabled site sharing and an owner not denied access.
- The reported sentence belongs to `ViewOpenPage`, not the public content
  handler. A signed-out `/view?id=…` launcher deterministically shows it. A
  well-formed private/unknown `/n/` entry normally shows the sign-in prompt;
  its generic failure instead requires a failed session read (other than the
  expected 401), or another exception. Lost address state alone therefore does
  not explain the reported sentence. The recipient's route shape and
  `/auth/session` response status were unavailable, so the cause is unresolved.
- `agent view list` intentionally reports frozen views, not gateway sharing
  state. The agent listener has no address authority and must not learn public
  capabilities. Its lack of sharing fields is not evidence that a view vanished.

## Decisions for later review

Keep this issue open rather than claiming a speculative fix. A reproduction
needs the synthetic view creation and sharing steps, the copied URL's route
shape (not its secret), the `/auth/session` status and redirect shape, and whether sharing
was still shown as public in Tuotokset. Do not request a dump of the installation
or a real capability URL. No new CLI surface or authority was added.

## Verification

Base revision: `18c67cfada2cf1f2a2e1f69d62369851766410ae`; final runnable diff
is the new browser persistence case (the preserving commit identifies it).

- `OH_WEB_WORKERS=2 ./scripts/test-focused.sh --area web`: passed, 255 files /
  2156 tests, lint and types.
- `./scripts/test-focused.sh --area go --go-package ./internal/gateway`:
  passed (81.304 s).
- `./scripts/test-focused.sh --area go --go-package ./internal/gateway
  --go-package ./internal/daemon`: the runner accepts one package, so the last
  argument selected daemon only; passed (570.470 s). Gateway was run separately.
- Named `view-links.spec.ts` and `agent-views.spec.ts` through the focused
  runner: 11 passed. Final named Playwright run with `--repeat-each 3`,
  `OH_BROWSER_WORKERS=2`, `OH_REPLY_DELAY_MS=60`, `OH_PORT_BASE=15180`:
  33 passed. The direct named run supplies repetition, which the focused shell
  wrapper does not expose; no whole suite or clean gate ran.
- `python3 scripts/generate-ui-reference.py --check`,
  `python3 scripts/validate-project-view.py`, `issuectl doctor --json`,
  `git diff --check`: passed.
- Independent critical `/llm-review`: claude-fable-5-2 finder, gpt-6-astra
  verifier. `/assess-findings`: three documentation/comment clarifications
  applied, one asserted test defect dropped because persistence coverage was
  explicitly requested and never claimed to reproduce the incident. No
  remaining actionable defect in this diff. Review and assessment are under
  `history/review-views-share-navigation.md` and
  `history/assessment-views-share-navigation.{json,md}`.

The initial browser run needed the pinned Pi SDK fixture installed; an early
version of the new test followed its redirect in the API client, which lacks
Chromium's synthetic host resolver, and got 421. It now inspects the entry's
302 without following it, then follows in Chromium. Final runs above pass.
Evidence logs are retained under `/var/tmp/agent-keep/views-jhtfx7/`.

No installed-host/real-ingress test ran. The actual shared-link incident is
unreproduced, not fixed, and the separate navigation-preservation requirement
is unmet. The combined worker therefore preserves commits without merging.
