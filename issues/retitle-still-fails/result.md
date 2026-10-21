# Result

## Cause and evidence

The failed live request was **2026-10-21 17:32:55 UTC** (20:32:55 Finnish time). Read-only journal inspection found the same request ID on both sides:

- Daemon: `POST /api/v1/conversations/{id}/history_title`, status 200, duration **12,338 ms**.
- Gateway: `daemon_route`, reason `daemon_exchange_failed`; browser response 503, duration **12,339 ms**.

The daemon transport's normal write deadline is five seconds. Neither `historyTitle` nor `regenerateTitle` extended it, although model generation alone has a 15-second budget. Go can finish the handler and log 200 after its socket write deadline without delivering that response. The gateway then sees the failed exchange, not the handler's JSON. This is a different defect from the earlier stopped-history operation selection fixed in d3409c48. That earlier issue's result is in the historical `issues/title-regenerate-broken/item.md` (`git show 683316bf^:issues/title-regenerate-broken/item.md`), not a separate result file.

A new real-HTTP regression creates and settles a synthetic conversation, then exercises both the live handler and its stopped-history counterpart. A 120 ms model call outlives a 50 ms ordinary server write deadline. **Before the fix both subcases fail with EOF**, reproducing the lost reply without using personal histories or calling a real provider. Baseline log: `/var/tmp/retitle-baseline.log`.

The live logs establish the transport failure, not whether that particular provider call produced a title or a fixed model failure; the expired deadline hid either outcome. No personal conversation content, credentials or raw provider diagnostics were read or copied. No Fleetrepo installation change is indicated.

## Changes

- Both explicit title handlers extend only their own response write deadline to 45 seconds, beyond the existing bounded model/native work and below the gateway's 60-second finite request budget. Global transport limits and native ownership/writer proofs stay unchanged.
- Stopped-history model errors retain the same fixed timeout/invalid/unavailable reasons as live requests, with content-free diagnostic logging.
- The client retains allowlisted title failure codes and gives an actionable model-specific notice. A lost or unknown reply still tells the person to check the actual title/state before retrying. There is no automatic retry, fallback write, or exposure of provider text.
- Unit coverage rejects unknown reason text and proves neither title operation retries; no UI wording is asserted.

## Validation

Final checked revision after rebasing onto both parallel workers: `0f2e99eee813f9203ec8f5a8cbb18f6373ef2fd1`. Daemon/contracts checks ran at `52f17c40f79bcc0edd4da49d3865cf5f8b01b880`; comparison confirms the subsequent composer rebase changed no `internal/`, `test/browser-host/`, `contracts/`, `go.mod` or `go.sum` inputs.

- `./scripts/test-focused.sh --area web`: passed after the final rebase; formatting, lint, TypeScript, 84 files / 477 tests. Log: `/var/tmp/retitle-final-web.log`.
- `./scripts/test-focused.sh --area browser --spec title-regeneration.spec.ts`: 3 passed after the final rebase, including notice/header accessibility. Log: `/var/tmp/retitle-final-title-browser.log`.
- `./scripts/test-focused.sh --area browser --spec native-history.spec.ts`: 11 passed after the final rebase. Log: `/var/tmp/retitle-final-native-browser.log`.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed again after rebase (90.150 s). Log: `/var/tmp/retitle-rebased-go.log`.
- `./scripts/test-focused.sh --area contracts`: passed again after rebase; generated contracts clean and all 61 remaining schemas valid. Log: `/var/tmp/retitle-rebased-contracts.log`.
- Additional review evidence: `go test -race -count=1 -v -run '^(TestTitleReplySurvivesOrdinaryWriteDeadline|TestHeldMessagesAcrossDaemonRestart)$' ./internal/daemon` passes on the fixed tree. Removing exactly the two deadline extensions leaves the existing held-message prerequisite passing and makes both new regression subcases fail with EOF. Logs: `/var/tmp/retitle-review-race-fixed.log` and `/var/tmp/retitle-review-race-baseline.log`. The original sources were restored byte-for-byte afterwards.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, `git diff --check`: passed, including final documentation validation.

Only `KOKEILTAVAA.md` conflicted during rebase. Both the incoming cloud-sync testing entry and this title-testing entry were retained, while the incoming deletion of obsolete folder-sharing checks remained intact. Title code replayed without conflict.

Independent bounded final-diff review: Claude Fable 5.1 found no code defects after reading the handler, middleware unwrap, gateway and client paths. Its initial attempt to run the Go harness failed at session creation (`native_source_unavailable`), including an existing prerequisite test; caller-side full-suite and before/after race evidence above resolves that environment limitation. The single context follow-up accepted the raw logs and confirmed the regression guards the fix; no remaining finding. Raw review: `/var/tmp/retitle-review.txt`, `/var/tmp/retitle-review-final.txt`; local review report: `history/review-retitle-still-fails.md`. No second model/verifier is warranted for this routine change to existing bounded operations, with no authority or native ownership change. Model-performance publishing is disabled for this no-push worker.

Tests use invented homes and fake Pi; they do not establish live-provider success or distinct-UID isolation. No full gate or deployment/push is part of this worker. The Finnish follow-up is in `KOKEILTAVAA.md`.

## Recovered tool failures

- Exploratory reads guessed several filenames, including the earlier issue's nonexistent separate `result.md`; source search and git history found the actual files. No evidence depends on those failed reads.
- A standalone archived baseline copy was refused by the Go dispatcher first for missing Git metadata and then for an unapproved common root. No local-build fallback was used. The same bounded baseline ran through the maintained dispatcher from this approved checkout, with backups and an EXIT trap restoring exactly the two temporarily removed deadline lines. The resulting EOF failures are expected regression evidence, not an outstanding failed check. Admission refusal log: `/var/tmp/retitle-snapshot-dispatch-failure.log`.
- The first rebase stopped at the ordinary documentation conflict described above; it was resolved without changing either worker's intent. The subsequent composer rebase applied cleanly. No required check remains failed because of these recovered steps.
- `issuectl close --status done` was refused because this tracker reserves `done` for non-bug work. Closed as `fixed`, its required delivered-bug status, instead; no issue type or transition rule was changed.
