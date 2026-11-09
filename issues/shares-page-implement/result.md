# Verification — 2026-11-09

Implemented round 4 behind Settings → Experimental features → Shares. No new host facts or contracts. Gateway changes only register `/shares` as an exact browser route and safe login return path.

## Evidence

- `./scripts/test-web-fast.sh`: 202 files, 1,525 tests passed, with type, formatting and catalog checks.
- `./scripts/test-focused.sh --area browser --spec view-links.spec.ts --spec settings-experimental.spec.ts --spec agent-file-offers.spec.ts`: 14 passed. Real synthetic gateway/daemon handlers, not UID-isolation or live-provider evidence. The new journey proves activity ordering against newer shares, experiment on/off, clipboard equals address field, duration/delete, mobile list/detail/back, direct route reload and Explain-mode deletion blocking. Axe covers the Shares UI, excluding the exported agent HTML document.
- `go test ./internal/gateway -run 'TestOAuthReturnRouteBoundToPendingFlow|TestRoutesDoNotFallbackAPIToUI|TestAuthenticatedFrameProtection|TestAppFramePolicy'`: passed.
- Full `go test ./internal/gateway` attempted twice; unrelated socket-based tests cannot bind long UNIX socket paths below the required home scratch directory. The shorter `~/.local/state/s` still exceeds Linux's limit for the longest test names. This is not reported as a green package run. No daemon code changed.
- UI-reference generation and `--check`: passed. Generation also refreshed pre-existing drift in `text--worktrees.tsx.md` to match its already-committed source; this task did not change worktree behavior.

Paired synthetic-lab captures in `evidence/`: 1440/390 light/dark list, 390 light/dark selected share, and Finnish/US-English Explain conversation cards at both widths. Inspected layout, control order, field copy target, dark exported-document canvas and card fit. The captured content is two invented HTML exports; existing file-offer browser specs cover the reused folder/file preview controls. No real homes or user data captured. UK uses the same card wording. Touch-specific second-tap behavior was not separately exercised.

## Review

Broad browser integration warranted `/llm-review` plus `/assess-findings`, rather than self-review alone. Finder `claude-fable-5-1`, verifier `gpt-6-astra`; two calls, local source checks. Four confirmed findings fixed: preserve typed write errors; retain paused-publication/private behavior; keep known rows mounted during metadata refresh without calling unresolved targets removed; do not substitute another item for a stale selected address. Also guarded deletion's return navigation against an already-unmounted detail.

Review/assessment scratch: `history/review-shares-page.md`, `history/assessment-shares-page.{json,md}`. No follow-up issue warranted. Review used no performance logging. Logs remain in `~/.local/state/shares-{fast,browser-final,browser-capture,go}.log` on the worker host; this result records the durable conclusions.
