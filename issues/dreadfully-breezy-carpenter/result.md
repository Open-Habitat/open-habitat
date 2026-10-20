# Editor origin isolation

## Delivered design

Restored a0a55c37 by reverting 5e38347e, then added single-label templates for Cloudflare Universal SSL. Set `oauth.editor_origin` to `https://oh-code-*.example.test`. Each authenticated provider/subject keeps its deterministic SHA-256/base32 id (52 lowercase characters), substituted for the single `*` inside the leftmost DNS label. Configuration rejects malformed DNS labels, expanded labels over 63 characters, non-HTTPS, ports, userinfo, paths, query/fragment delimiters, multiple stars and stars outside the first label. The app cannot occupy the editor namespace.

The previous deep form (`https://code.example.org` → `<id>.code.example.org`) remains supported for independent installations with wildcard certificates covering those children. It uses the same host matching and identity binding, not a compatibility shim. Both forms are documented in `docs/operations.md`.

The gateway binds handoff redemption and every authenticated editor request to the identity's exact host. Writes and upgrades require its exact Origin; host-only `__Host-oh-editor` cookies stay separate across identities. Logout/revocation/expiry end editor authority. No registry or daemon authority changed. A surviving previous person's document cannot inherit the next person's editor session. Storage clearing remains defense in depth, not isolation.

Only the exact app Host reaches app UI/authentication, including when editor configuration is absent. Unknown sibling names, malformed child names and the template parent are rejected with 421 before ServeMux redirects, app cookies or app UI. Syntactically valid child hosts reach the editor-only handler; grants/cookies for another identity are refused there. Health/readiness GET/HEAD probes remain available.

Until Fleetrepo sets the template, the current single-host config `https://open-habitat-test-code.example.test` **fails closed for editor sessions on that shared host** (editor unavailable through the current route), without breaking the app. That legacy value derives deep child names, which the current DNS/certificate do not support; it never falls back to a shared editor session.

## Fleetrepo deployment prerequisites

After deploying this product change:

1. Add wildcard DNS `*.example.test`, CNAME to the existing shared tunnel.
2. Add cloudflared ingress `*.example.test` targeting the **same gateway listener as the existing editor rule**, placed **last before the 404 fallback**. Keep earlier specific services first. Preserve the browser's Host. Keep the existing `originServerName` and CA unchanged; no new origin certificate or Advanced Certificate Manager is needed for the single-label edge hosts.
3. Set the gateway's `oauth.editor_origin` exactly to `https://oh-code-*.example.test`. Apply the same Access policy, audience and trusted ingress-header treatment to child hosts as to the current editor route; reserve `oh-code-*` names for this gateway.
4. Verify two identities receive distinct `https://oh-code-<52-character-id>.example.test` origins. Each must load its editor and WebSocket; a grant or copied cookie on the other's host must fail. Keep A's document alive across logout/login as B and verify it cannot read B's session; logout must end the relay.
5. Request an unknown sibling, e.g. `https://oh-unknown-probe.example.test/`, including `/auth/github/start`: expect 421, no Location or Set-Cookie and no app UI. Verify the template parent `https://example.test/` and malformed child names cannot reach the app (send Host directly to the listener when DNS routes elsewhere). The configured app host must still serve the app, login and health/readiness. The old single editor host must not accept sessions.

No Fleetrepo edit, push or test-server access is part of this worker. The conductor owns installation and live verification.

## Validation

Tested starting commit `d4ebc40294ed655a2566a311d2632916d19313dd` plus restoration and final patch. SHA-256 of `git diff d4ebc402 -- internal/gateway test/browser-host/main.go web/tests/workspace-editor.spec.ts`: `ac312fa3f311a40f7b090506f6e34d606f68052448b9a80e5acc359984ed3941`. Builds/tests use `umask 077; TMPDIR=/var/tmp`.

- `./scripts/test-focused.sh --area go --go-package ./internal/gateway`: PASS, full gateway package with race detector, final run 9.789 s. Covers template validation at auth load, malformed/unknown Hosts without cookies or redirects, per-person grants/cookies, foreign-Origin writes/upgrades, and logout/revocation/expiry.
- `./scripts/test-focused.sh --area contracts`: PASS, generated drift clean, 54 schemas, 51 fixtures, 36 scenarios, 17 negative checks.
- `./scripts/test-focused.sh --area web`: PASS, format/lint/types, 262 unit and 180 component tests; existing informational lint messages only.
- `go test ./test/browser-host`: PASS (2.214 s).
- `OH_PORT_BASE=24600 OH_BROWSER_WORKERS=1 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright ./scripts/test-focused.sh --area browser --spec workspace-editor.spec.ts`: PASS, all five cases (29.2 s final run), including accessibility, interaction, phone behavior and surviving A document across actual logout/login as B.
- `python3 scripts/validate-project-view.py`, `git diff --check`: PASS. `issuectl doctor --json`: no new metadata defects (unrelated existing image advisories).

Independent critical `/llm-review` completed with finder `claude-fable-5-1` and false-negative verifier `gpt-6-astra`, followed by `/assess-findings` (scratch under `history/`). Neither found a concrete security bypass. The verifier independently passed focused editor/Host Go tests. The finder caught a stale remote-storage comment in the daemon; corrected that comment only. Its fixture-domain observation does not establish a new regression in the automated spec: the app host was already hardcoded before this task, so that spec never supported the manual probe's domain override. Assessment: one comment FIX applied, one candidate DROP after local refutation; no actionable security findings remain. Manual engine probes need TLS routing for portless editor hosts; they were not rerun. Model-performance logging was intentionally disabled because its helper pushes, contrary to this worker's no-push restriction. The risk is browser-to-Unix-user editor authority, so this warrants independent review despite the narrowly scoped implementation. The full clean gate and distinct-UID VM tests were not run: this changes no kernel UID, broker, daemon authority, shared app-auth algorithm, contract or build dependency. The test-only editor fixture change is confined to its portless origin and its spec's Chromium mapping; focused browser-host and browser checks cover that seam. Synthetic tests do not establish live Cloudflare routing/certificates or real code-server deployment behavior.

No visual UI changed; browser tests exercise routing and session isolation, so visual captures do not apply. Browser fixture editor hosts are portless templates; Chromium maps their TLS traffic to the worker's private test listener, preserving the actual browser origin and Host. The app retains its worker port.


## Failure inventory

The first focused gateway run failed existing assertions expecting 400 for a foreign Host (callback diagnostics and conversation status), now correctly rejected earlier with 421. Updated these assertions without weakening rejection. The second run exposed that the diagnostics test buffer already contained the login-start event; changed its assertion to require no additional event for the rejected Host. Subsequent gateway/contracts runs passed; final gateway/browser-host/browser checks passed again after a hostname-comparison tightening. No required check remains failing.

One exploratory `rg` included nonexistent `internal/gateway/gateway.go`; a skill read used the wrong pi-processes path; directory checks for nonexistent local AGENTS files and an absent web dependency directory exited nonzero. The actual scoped files and installed skill were then read; `npm ci --prefix web` supplied dependencies. These were lookup/setup errors, not omitted validations. No required review call has failed.
