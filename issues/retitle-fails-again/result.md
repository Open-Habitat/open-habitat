# Result

## Cause and evidence

Read-only live journals for Jari's morning attempt show request `I3dkZPwK92s-d19G` finishing at **2026-10-22 05:25:18 UTC** (08:25 Finnish time): daemon `history_title` **200 / 11,196 ms**, gateway **200 / 11,197 ms**. The previous response-deadline fix is working; this is not another lost gateway reply. No model-failure diagnostic occurred for the request interval. The handler's remaining failed-200 paths are the temporary native child's name acknowledgement/reaping, not model generation. A metadata-only scan found no native `session_info` timestamp in 05:24–05:26; names and conversation contents were not emitted or copied.

The stopped-history handler launched a **cold Pi** and immediately sent `set_session_name` with the same four-second budget used by an already-ready live conversation. That budget includes extension loading before Pi reads stdin. On the actual guest, a disposable synthetic home/workspace and synthetic resumed history, running as the mapped UID with the installed Pi/Claude/process extensions, acknowledged that command after **7.231 seconds** and persisted the synthetic title. A warmed repeat took **1.755 seconds**. Neither probe used personal history, credentials or a provider/model call; both temporary homes were removed. Raw synthetic probe and results remain at `/var/tmp/retitle-native-probe.py`, `/var/tmp/retitle-native-probe.log`, `/var/tmp/retitle-native-probe-baseline.log` on Alder. The warmed repeat is not a failing baseline: it demonstrates why this can appear intermittent.

The cold-start timeout is therefore a demonstrated defect on the installed runtime and is consistent with the live request's native failure. The journal does not record the exact native acknowledgement error, so it cannot distinguish every internal failure in that one historical request. In particular, this is not a claim that the synthetic probe replayed Jari's private conversation.

## Change and regression

Only the temporary history-title child's acknowledgement budget changes, from four to fifteen seconds. It includes startup; a live already-ready child's write remains four seconds. No automatic retry, provider fallback, new process authority or ownership-proof change. The bounded stages total at most about 41.2 seconds: model work (15 s), admission wait (2 s), native acknowledgement (15 s) and shutdown/reaping (9.2 s). Native scans consume additional time under the unchanged 45-second handler response deadline and 60-second gateway budget; these bounds do not guarantee delivery for arbitrarily slow filesystem reads.

The regression creates and settles a synthetic native conversation, stops its controller, then retitles it through the stopped-history handler. Its resumed fake Pi waits 4.3 seconds before reading commands and appends the title through the synthetic native protocol. Assertions cover a successful reply, the persisted native name and exactly one temporary writer (no retry). With only the production timeout restored to four seconds, the test fails with **HTTP 200 / state failed / name_write_failed** after 4.05 seconds. With the fix it passes after 4.37 seconds. Baseline and fixed logs: `/var/tmp/retitle-go-baseline.log`, `/var/tmp/retitle-go-focused.log`.

## Validation

Checked code revision: `cfbf2b83` (handler and regression; documentation follows separately).

- `umask 077; TMPDIR=/var/tmp ./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed on the final test source, **113.222 s**; `/var/tmp/retitle-go-final-current.log`. An earlier package run also passed; the final run follows a test-fixture readability edit, so no stale result is reused.
- `go test -race -count=1 -v -run '^TestHistoryTitleAllowsColdPiStartup$' ./internal/daemon`: passed, **5.414 s** including race overhead; `/var/tmp/retitle-go-race.log`.
- `./scripts/test-focused.sh --area contracts`: passed; 62 schemas, 67 fixtures, 40 scenarios, 17 negative checks; `/var/tmp/retitle-contracts-final.log`.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`: passed.

Independent final-diff review used Claude Fable 5.1, with one focused GPT-6 Astra verification of its sole candidate. Both completed. The candidate correctly identified omitted admission/cleanup time in the explanatory budget sum; that explanation is corrected above. Increasing the response deadline to55 seconds was dropped under assessment rule1b: it adds margin without fixing an observed failure and requires multiple near-ceiling successful stages, slow scans and slow shutdown/escalation. No measured scan delay or response loss establishes that rare combination, and55 seconds would not bound scans either. No issue filed. Review artifacts: `history/review-retitle-fails-again.md`, `history/assessment-retitle-fails-again.{json,md}`; raw outputs `/var/tmp/retitle-independent-review.txt`, `/var/tmp/retitle-verifier.txt`. Two calls were proportionate because the first raised a specific timeout-boundary candidate; no panel or further review was warranted. Performance publication was disabled for this no-push worker.

No browser/UI code, contract schema or packaging changed; browser checks and the full gate are not part of this worker. Native ownership guards are unchanged, so no new distinct-UID isolation claim is made.

The conductor must push after landing, wait for the watcher to report the new source installed, and verify the stopped-history retitle on that release. This worker does not push or claim post-release verification. `KOKEILTAVAA.md` replaces the previous attempt's testing line with the cold-start scenario.

## Decisions for later review

None requiring a product or architectural choice. Fifteen seconds is a bounded cold-start allowance, not a new user-facing timeout policy or an automatic retry.

## Tool/sub-workflow inventory

Exploratory reads guessed nonexistent `internal/daemon/AGENTS.md`, `pi_state_linux.go`, an uninstalled SDK source path and the old location of the process skill. The actual parent instructions, RPC implementation and process skill were found and read; no required work depends on those failed reads. The expected baseline regression failure is intentional evidence, not an unresolved failed check. The synthetic probe's warm repeat completed below four seconds, so it is recorded as a warm control rather than claimed as reproduction.
