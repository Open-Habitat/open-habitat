# Result

Implemented in the commit carrying `Fixes-Issue: @frame-ancestors-missing`.

The outermost gateway handler sets `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY` before ingress, diagnostics and routing. This covers authenticated and foundation configurations, without changing daemon or broker authority.

## Evidence

- Baseline: exported pre-change HEAD with the expanded route/header tests. Static HTML, assets, robots.txt, API/auth errors, health, OAuth redirects, unknown routes, method errors and canonical-path redirects all failed the missing-protection assertions.
- Final `go test -race -count=1 ./internal/gateway ./internal/transport ./internal/core ./internal/cli ./test/browser-host`: passed, including additional coverage of Access ingress denials outside the route mux.
- `./scripts/test-focused.sh --area contracts`: passed. No contract or browser production code changed.
- Fast web checks and the focused two-case logout/browser run passed alongside this change; see `streams-outlive-revocation/result.md` for exact commands.

## Decisions for later review

None: the two header values and every-response scope were explicitly agreed in the issue.

## Limits

Synthetic header and browser evidence only; no live-host update, cross-origin framing attempt or full clean gate. Full clean gate belongs to the conductor's round check. No push or deployment performed.

## Independent review and assessment

Final-diff review by `claude-fable-5-1` and focused boundary verification by `gpt-6-astra`: no confirmed defects or actionable findings. `/assess-findings` table has no rows; no residual issue filed. Both reviewers checked the outer wrapper and absence of downstream header replacement. The host's final Go/contracts checks pass; project-view, tracker and whitespace validators pass. Review used `--no-perf-log` to avoid remote corpus pushes.

Tested source: base `0f5171328f4fee8f84ba5a5f9a16f90ac0728df8` plus reviewed diff SHA-256 `7b281aee408423789faee21ad31bf42cb9ff947a2828df4ef01024447f2b6e3b` (source unchanged after review).
