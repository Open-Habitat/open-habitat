# Editor origin isolation

## Delivered design

The configured `oauth.editor_origin` is now a reserved hostname namespace, not a shared editor origin. Each authenticated provider/subject has a deterministic SHA-256/base32 child host. No account registry, identity authority or daemon protocol was added. The gateway binds both handoff redemption and every editor-session request to that identity's exact host. Writes and upgrades require that same exact Origin. Host-only `__Host-oh-editor` cookies remain separate in a shared browser profile; a prior person's documents and service workers never gain the next person's origin.

The previous base host refuses editor requests. Existing single-host installations therefore fail closed until their wildcard route is installed. Storage clearing remains defense in depth, not the isolation mechanism. No visual UI changed; no before/after visual captures apply.

## Fleetrepo deployment prerequisite

For the currently recorded base `https://open-habitat-test-code.example.test`, keep that `editor_origin` value and reserve `*.open-habitat-test-code.example.test` for this gateway:

1. Add wildcard DNS to the existing tunnel and a cloudflared ingress hostname rule for `*.open-habitat-test-code.example.test` targeting the same gateway listener as the existing editor host. Preserve the original child Host header (do not rewrite it to the base host).
2. Provision an edge certificate covering `*.open-habitat-test-code.example.test`: Cloudflare Universal SSL alone does not cover these deeper names; use Advanced Certificate Manager or a custom edge certificate. Include that wildcard in the gateway certificate if the tunnel's TLS origin hop verifies against the request hostname, or configure an explicit verified origin TLS server name matching its gateway certificate.
3. Apply the same Cloudflare Access policy, audience and trusted ingress-header treatment to the wildcard as to the current editor host. Do not delegate child names or serve unrelated content beneath this base.
4. Run health/readiness probes against the app host, not the retired shared editor base. Deploy the product and verify two people receive distinct child hosts, each can load code-server and its WebSocket, logout ends their relay, and the old shared base cannot mint or accept an editor session.

No Fleetrepo changes, push, or test-server access were performed by this worker. The conductor owns installation and live verification.

## Validation

Tested baseline `c29b05fad65b0dbec72c320b7fbb71d09bdf00bc` plus the final gateway/browser-test patch (SHA-256 of `git diff HEAD -- internal/gateway web/tests/workspace-editor.spec.ts`: `5f2597ee7575678ab2bb1f7af7e51ca432423a8993d04bc212e1d0192b6416f0`). Linux builds use disk-backed `TMPDIR=/var/tmp`.

- `umask 077; ./scripts/test-focused.sh --area go --go-package ./internal/gateway`: PASS, full gateway package with race detector (9.5 s final run). New regression denies cross-person grants and cookies, foreign-Origin writes, the old shared base, and unexpected child hosts; existing upgrade logout/revocation/expiry tests remain passing.
- `./scripts/test-focused.sh --area contracts`: PASS, generated contract drift clean; 54 schemas, 51 fixtures, 36 scenarios and 17 negative checks valid.
- `./scripts/test-focused.sh --area web`: PASS, format/lint/type checks, 262 unit and 180 component tests. Two pre-existing informational lint messages in the engine probe script; no errors.
- `OH_PORT_BASE=23500 OH_BROWSER_WORKERS=1 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright ./scripts/test-focused.sh --area browser --spec workspace-editor.spec.ts`: PASS, all five cases including accessibility, file/keyboard integration, phone behavior and the new same-context Alice→Bob surviving-document test (30.5 s final browser run).
- `python3 scripts/validate-project-view.py`, `git diff --check`: PASS. `issuectl doctor --json`: no new issue metadata defects; existing repository image-format/size advisories remain unrelated.

Security risk justified an independent critical `/llm-review` with finder `claude-fable-5-1` and false-negative verifier `gpt-6-astra`, followed by `/assess-findings`. The finder identified malformed editor-child hostnames falling through to app static UI; fixed by routing the entire namespace to strict editor rejection, with regression coverage. Its two informational observations were already addressed or covered: the hash does not promise secrecy, and Chromium performs actual logout/login rather than only mutating the unit fixture. The verifier inspected the final host, token, cookie, relay and postMessage/remount boundary and found no concrete bypass. No actionable findings remain. Review/assessment scratch is in `history/`; the substantive evidence is recorded here so it survives teardown.

Focused checks are proportionate because executable changes are confined to editor gateway authority and namespace routing: no shared app-auth algorithm, daemon protocol, contract, build dependency or fixture implementation changed. The full clean gate and distinct-UID VM scenarios were not run; no Unix account/daemon/kernel authority changed. This proves synthetic gateway and browser origin separation, not the live Cloudflare installation or real code-server behavior after wildcard deployment.

## Failure inventory

Initial focused gateway tests failed in the existing `TestAuthenticatedGatewayToTwoDaemonSnapshotHandlers`: import returned `checkout_unavailable`. Two isolated retries reproduced it. The inherited shell umask was `0002`, which gives Go fixture directories group-write permission; the clone home ownership check correctly rejects that. Repeating with `umask 077` passes. Final checks use `umask 077`; no security check or test was weakened. Exploratory searches for nonexistent `clone*`, `repo*` and `source_linux.go` paths returned no matches; reading the actual `github_jobs_linux.go`/`github_clone_linux.go` settled the cause. The initial Playwright binary lookup found no local dependencies; `npm ci --prefix web` supplied them before the required browser run.

One later two-worker browser rerun passed the new isolation case but intermittently failed the existing hidden-conversation keyboard-focus assertion (`workspace-editor.spec.ts:134`). `scripts/inspect-trace.sh --json` confirmed an inactive composer at that assertion; there was no failed isolation assertion. The unchanged complete spec then passed with one worker. No assertion was removed or relaxed. Initial browser run had also passed all five cases with two workers. This intermittent interaction test failure is disclosed for the conductor; no required check remains failing. An early `issuectl ready` correctly reported the review criterion still pending; it is checked after review. Premature reads of pending log paths returned not-found and were superseded by completed process notifications and final logs. Both model calls completed successfully. No required review, build or test was omitted.
