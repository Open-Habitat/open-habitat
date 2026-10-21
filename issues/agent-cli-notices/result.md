# Agent CLI notices — implementation and evidence

Implemented on base `b6d1df9a7c95121f2b601b5447e23f37f03d53e8`. The staged source/test diff (`git diff --cached HEAD -- internal web contracts test scripts`) had SHA-256 `a52f242434aff929be1104a742f139841b8333c17c5316b33063a3e11f8bbcab` before this evidence was added. The implementation commit's `Refs-Issue` trailer identifies the final source.

## Acceptance evidence

- `agent notice create --conversation pi:UUID` or `--current`, with required UUID `--idempotency-key` and bounded plain text (`--text` or `--text-file FILE|-`). Dry-run validates without writing. `notice list` reads the current native branch, including other own native conversations without starting Pi; the latest 200 notices carry `has_more`, with no-clobber JSONL export.
- Pi remains the only history writer. The shipped companion calls native `appendEntry` through the existing private bridge, not a prompt or model call. `TestRecapPinnedPiNativePersistence` now creates and verifies a notice through the real pinned Pi while another native extension command is pending. The bridge checks both the active native SessionManager ID and daemon launch generation so a native session switch within a PID cannot redirect an old launch's notice.
- Only a stable native disk read establishes `persisted`; a known failed append can report `not_persisted`, while an inconclusive reply/read stays `unknown`. One failed observation may retry the read, never the write. The existing per-user event journal carries a best-effort transient card when persistence is not proven. It is not a delivery/seen receipt. No notice database, approval system, gateway route or broker capability was added.
- Native notice entries reopen as agent-labelled, timestamped cards. Agent text is React text, not interpreted HTML, Markdown or links. Transient cards are conversation/identity scoped, are reconciled when native history proves persistence, and are discarded on tab model disposal. Synthetic screenshot/static HTML pairs: [persisted](screenshots/notice.html), [temporary](screenshots/temporary-notice.html), with adjacent PNGs.

## Checks

Commands ran with `umask 077` and disk-backed `TMPDIR=/var/tmp/oh-notice-build` for Go builds:

| Command | Result and limits |
|---|---|
| `go test -race ./internal/daemon ./internal/cli ./test/browser-host` | Passed after the session-switch fence: daemon 92.267s, CLI 8.301s, browser-host cached from the earlier passing run. Pinned real Pi persistence is included; it did not skip. Newly strengthened session-switch/stale-launch tests were then run with `-race -run 'TestNotices\|TestNativeNotice\|TestNoticeStale'`, passing in 1.054s. |
| `node --test internal/daemon/pi-device-test/notices.test.mjs` | Passed: the real shipped bridge catches an injected EDQUOT exception without leaking native errors, retrying, consulting the processes registry or prompting the model. It also rejects an actual change to the mocked active SessionManager ID while retaining the original launch/request. This is exception-injection evidence, not kernel-quota enforcement. |
| `./scripts/test-agent-uids.sh` | Passed again on final runtime code (20s command wall time). Real distinct-kernel-UID owner/root/gateway/other-user denials, including notice routes, plus existing activation/default-deny/provision restoration scenarios. Disposable networkless namespace; not an installed live-host receipt. |
| `./scripts/test-focused.sh --area contracts` | Passed: 60 schemas, 61 fixtures, 39 scenarios, 17 negative checks; generated bindings clean. |
| `./scripts/test-web-fast.sh` | Passed after final client regressions: 82 files, 480 tests, 24.25s Vitest time; format/lint/typecheck also passed. |
| `./scripts/test-focused.sh --area browser --spec agent-notices.spec.ts` | Passed through the maintained remote browser runner: 2/2 Chromium cases in 4.8s test time (177s command wall time including admission/queue/setup). Covers native reopen/inert content/timestamp/axe and live nonpersistent journal delivery scoped to its conversation, with loss on full navigation/reload. Publication is synthetic fixture input to the real journal, not a native provider session or actual full quota. |
| `project-canon review --profile cli --run <built binary> --json .` | Advisory completed. The documented legacy probe/envelope false positives remain; notice help leaves, fixed error/exit contract, required target/key, no-write dry-run, no-clobber export and embedded skill were checked directly and by CLI tests. `CONFORMANCE.md` records limits, including daemon-owned live timestamps rather than a frozen-time provenance override. |
| `python3 scripts/validate-project-view.py`, `git diff --check`, `issuectl doctor --json` | Project-view/diff checks pass; issue doctor checked at completion. No full gate was run. |

## Independent review and assessment

Required security-focused `/llm-review` completed with `claude-fable-5-1` finder and `gpt-6-astra` verifier, plus one narrow critical continuation for the final session-switch fence. `/assess-findings` produced `history/assessment-agent-cli-notices.{json,md}` from `history/review-agent-cli-notices.md` (local scratch, not prerequisites for understanding this result).

One confirmed behavior issue was fixed: an uncertain transient card could duplicate a later verified native card. Regression cases cover event/page reconciliation and late uncertain arrival. A claimed violation when a moving file produces `unknown` was dropped: uncertainty is the truthful contract outcome; the additional read-only retry merely reduces avoidable uncertainty. The verifier confirmed final scoping, disposal, synchronous target check/write and persistence semantics. No outstanding confirmed security finding and no follow-up issue filed.

## Deployment and limitations

No Fleetrepo change is needed: this uses the already-installed slice-1 agent listener and the product's existing Pi companion bridge. This worker did not deploy a release or perform live test-server acceptance. After the source lands and the normal release watcher deploys it, a native agent on the disposable test server can exercise the same command with an open browser, including a real exhausted-quota case. Do not substitute this synthetic evidence for that live kernel-quota observation.

Pi updates its in-memory branch before a native append failure, including ordinary message failures. After EDQUOT, a later native branch may therefore be unavailable rather than recover automatically. This slice does not retry writes, fabricate persisted history, or introduce an out-of-band repair writer. A browser need not be open, and an event may be missed: CLI success never claims human delivery. A newly created conversation without readable native history returns `conversation_not_found` rather than inventing persistence.

## Failure/incomplete-work inventory

- Required development failures were resolved and their affected checks re-run: initial Go response-body variable collision and permissive-umask test failures; initial Biome callback/type errors; initial Chromium assertion assumed `/agents/` instead of the workspace conversation query route. Final required checks pass. The verifier's initial native test also lacked the private umask, then passed after correcting it.
- Discovery/usage errors were corrected without state loss: the brief's stale ADR filename (actual accepted path is `docs/decisions/adr-0027-agent-cli-route.md`); missing `--diff-files` argument on the first consult command; legacy canon JSON was initially queried as an envelope; `taskfleet --version` was corrected to `taskfleet version`; the issue's refused direct `open → testing` transition made no change and was replaced with the allowed lifecycle path. Dependencies were installed with committed lockfiles before tests.
- Optional developer-machine socket dry-run was refused with `agent_socket_untrusted` because this development user's agent service is not installed. No real-home/native read or write was performed; it is not a test-server failure. Synthetic service tests are the acceptance evidence here.
- Optional model-performance corpus logging failed once with SSH-to-self `Permission denied (publickey,password)`, exit 3. Independent review itself completed. Scores remain in the local scratch `.cache/notice-model-scores.json`; diagnostic is `.cache/notice-model-log.stderr`. No credential or unrelated Fleetrepo/service change was attempted to work around optional logging.
- Not run: a full clean gate (explicitly excluded), live test-server/native enforced-quota acceptance. Neither is represented as passing evidence.
