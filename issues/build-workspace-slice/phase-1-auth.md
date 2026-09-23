# Phase 1: gateway authentication core

Tested product revision: `9b340cf4fa5554a2d8ecf099cafe72b33061e7de` (before this evidence-only commit). Issue remains `in-progress`. No parent acceptance criterion is checked.

## Delivered

`internal/gateway` now has injectable GitHub authorization-code/PKCE S256 provider and token sink interfaces, an HTTPS GitHub exchange plus authenticated `/user` numeric-ID lookup, trusted-configured fixed identity/socket mappings, bounded single-use five-minute flow state tied to a secure browser cookie, and server-side opaque sessions with 8-hour idle/24-hour absolute expiry, rotation, logout, exact Origin and session-bound CSRF checks. Callback consumes state before exchange, permits only exact parameter sets and valid encoding, and makes at most one token-sink call after identity resolution. No sink retry, token queue, gateway persistence or browser token output exists. Auth-capable handler construction is explicit (`NewWithAuth`); the foundation `New` routes remain unchanged and fail closed.

## Verification

- `export PATH="$PWD/.tools/go/bin:$PATH"; go test -race ./internal/gateway -count=1` — passed. `go vet ./internal/gateway` — passed.
- `mkdir -p "$PWD/.cache/ci-tmp"; export TMPDIR="$PWD/.cache/ci-tmp" PATH="$PWD/.tools/go/bin:$PATH"; ./scripts/ci-local.sh --clean --json` — passed on exact tested revision above; returned `{"status":"passed","clean":true}` inside the schema-versioned envelope. This includes the full Go race suite, browser package tests/builds, generation and packaging checks, and fixture self-test; it does **not** launch a multi-UID VM.
- `python3 scripts/validate-project-view.py` — passed (14 pages, 14 navigation entries); `issuectl doctor --json` — passed; `git diff --check` — passed.
- Focused two-model `/llm-review` (`claude-fable-5-1`, `gpt-6-astra`) examined provider/session/token boundaries. Locally confirmed and fixed unauthenticated pending-cap saturation (direct-peer admission) and abandoned-session retention (expiry sweep); verified the fail-closed TLS requirement. Notes: `history/review-phase1-auth.md` (ignored work-session scratchpad). No speculative residual was filed as an issue.

Deterministic tests cover PKCE challenge/verifier linkage, state replay/mismatch/expiry and malformed/duplicated callback parameters, provider error, unknown/invalid/duplicate identity, forged mapping hint rejection, failure on first and only sink attempt, absence of a session after partial failure, session rotation/fixation, idle expiry/logout, missing/wrong Origin or CSRF, plain HTTP denial, admission limits and no optional provider contact. Fake sink/provider errors contain a runtime-generated synthetic sentinel; response bodies, cookies, redirects and session JSON are checked not to contain it. Product auth code has no logger, argv invocation, environment export or token persistence; callback errors are generic and discard provider/sink error text. Tests never use real GitHub or real credentials.

## Limits / next phases

This is a tested gateway core, **not** a working login-to-workspace journey. The current CLI still serves the foundation handler on plain TCP. Phase 2 must wire a reviewed TLS listener and trusted root-owned config to this handler, supply the authenticated mapped-UID UDS sink and daemon-side numeric-ID/peer checks, prove atomic one-attempt token framing and partial native `gh` state, directory discovery and the two-UID VM path. Do not trust unvalidated forwarded TLS headers. This phase has no Google OIDC implementation; Google is not contacted and its route remains unavailable. Phase 3 owns browser integration, screenshots, host-backed acceptance and final review. The per-direct-peer admission limit does not stop a distributed login flood; production edge rate controls and sizing remain integration work. No `gh` commands, Fleetrepo or real-user state were touched.
