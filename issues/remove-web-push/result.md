# Result: Web Push removed

Removed the experimental card, settings search entry and Finnish/English copy,
permission/subscription/presence code, service worker, push-only manifest/icon,
daemon sender/store and turn hooks, gateway routes, crypto package, contract,
fixtures and feature-specific tests. Regenerated both contract fingerprints.
The shared confirmed-preferences hook remains for recent conversations.
`docs/product.md` already excluded browser/OS notifications; no edit was needed.
Operator guidance and obsolete internal instructions are removed; KOKEILTAVAA
now asks to check the removal rather than enable the feature.

## Evidence

Tested the removal working tree based on f9ea3112ac54e844c3b42fc6209d187ac382c413,
with Go under umask 077 and short disk-backed TMPDIR on Birch. Rebased onto
728dee81 (including the parallel dictation cancellation change), then reran
contracts, web and the named browser spec successfully on 4af6c7ce. Go inputs
were unchanged by that rebase.

- `./scripts/test-focused.sh --area contracts`: pass (88 schemas, 134 fixtures,
  43 scenarios; generated packages clean).
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: pass.
- `./scripts/test-focused.sh --area go --go-package ./internal/gateway`: pass.
- `go test ./test/browser-host`: pass.
- `./scripts/test-focused.sh --area web`: pass (static, unit and component).
- `OH_PORT_BASE=9890 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec settings-experimental.spec.ts`:
  3 passed, including remaining-card count, persistence, failed save, search and
  axe checks. Host-backed synthetic evidence, not live deployment/UID isolation.
- `python3 scripts/validate-project-view.py` and `git diff --check`: pass.
- `issuectl doctor --json`: existing repository hygiene findings (448 non-AVIF
  images and missing item.md for decisions-review-31-10); no schema drift,
  broken references or conflict markers. Closing this task warned about its
  pre-existing absence of an Acceptance Criteria section (non-blocking).
- Scoped source search for VAPID, push notification identifiers, permission and
  service-worker registration: no live remnants. Ordinary Git push operations
  and historical benchmark/issue material are unrelated and retained.

Deleted tests covered Web Push crypto vectors, endpoint restrictions, subscription
storage, sending/de-duplication/presence, notification clicks and permission/UI
flows. Those behaviors are intentionally absent, not moved elsewhere. Remaining
preferences, conversations and gateway behavior retain their package tests;
experimental settings retain their browser tests.

Independent `/llm-review` (claude-fable-5-1 finder, gpt-6-astra verifier) and
`/assess-findings`: one confirmed FIX. The initial removal took away the shared
confirmed-preferences hook still used by the recent-conversation rail. Restored
it without push logic; final web checks and browser cases pass. No unresolved
finding. Scratch review/assessment artifacts are under `history/`.

Initial checks needed correction: the focused Go wrapper accepts one internal
package per invocation (browser-host tested directly); daemon schema tests needed
the disposable Python venv on PATH; Biome required collapsing the shortened
feature list. Reviewer Go attempts used overlong socket paths. These failures
were resolved or superseded by the worker's passing focused checks. No full
clean gate or whole browser suite was run.

## Fleetrepo

Read-only checkout `~/Sources/fleetrepo`: searched tracked `infra/` and `dotfiles/`
for VAPID, Web Push, push-sw and the feature id. No installed key, unit or config
was found; no Fleetrepo change is needed or made.

## Decisions for later review

1. Remove the web manifest and apple-touch icon added solely for iPhone push,
   rather than retaining an unrequested installable-web-app feature. The ordinary
   favicon stays.
2. No migration or destructive scan of existing homes/browser profiles. An old
   `push.json`, experimental-map key or browser registration can remain inert;
   this release contains no reader, sender, registration or permission request.
   Alternative: retain cleanup compatibility code. Rejected for this prerelease
   removal because it perpetuates a feature-specific runtime and touches personal
   state unnecessarily. Already queued vendor notifications are not recalled.
