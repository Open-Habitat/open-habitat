# Part 1 result

Fixed the failed-turn presentation and running-list membership; no new sign-in notice/button, daemon or contract change.

## Native observation

On Birch, 4 November 2026, ran the pinned Pi 1.3.0 CLI (`--mode json --provider claude-bridge --model claude-sonnet-4-6 --no-tools -p 'Say hello.'`) with bridge 0.9.3 / Claude SDK 0.3.301. Each run had its own disposable HOME/cwd, minimal environment and invented invalid credential, never the person's credentials or sessions. OAuth used `.claude/.credentials.json` with expired access and invalid refresh tokens; key used an invented `ANTHROPIC_API_KEY`.

Both yielded an SDK assistant with `model: "<synthetic>"`, `stop_reason: "stop_sequence"`, `error: "authentication_failed"`, `is_api_error_message: true`; the following result had `subtype: "success"` **and** `is_error: true`, `terminal_reason: "api_error"`. Refused key additionally had HTTP 401. Exact text:

- OAuth: `Failed to authenticate: OAuth session expired and could not be refreshed`
- Key: `Invalid API key · Fix external API key`

The bridge already translates correctly: Pi assistant `content: [{type: "text", text: <above>}]`, `errorMessage: <above>`, `stopReason: "error"`, in both live message_start/message_end/turn_end and persisted native JSONL. Agent end had `willRetry: false`, followed by `agent_settled` with `aborted: false`. Neither stream had any message_update/text_delta. No text-based failure guessing is needed.

Private disposable reproduction script and raw synthetic evidence: `/var/tmp/oh-ai-sign-in.DvdGa7/` (not a durable dependency). The screenshot named in the brief was absent at `/var/tmp/oh-r57-auth.png`; diagnosis instead used the issue description and reproduced the exact error.

## Cause and repair

The older individual-entry renderer respects stop_reason. The grouped timeline renders through AgentTurn, which never received that state and unconditionally labelled its final text complete. It now carries the failed stop to the existing AssistantMessage failed presentation; empty failed turns also have a failed card, and a saved failure is not merged with a stale live tail.

The rail intentionally retained every failed turn in Käynnissä, so its section count remained nonzero even though workspace working hints already excluded failures. Settled `turn_error` now goes to Hiljaiset with its failure marker. Active work, unread attention, live workers, crashed/cut processes and failed workers keep their existing rules.

## Decisions for later review

- Apply the failed rendering to every native error stop, not only OAuth strings: native stop is authoritative, avoids misclassifying ordinary assistant prose, and handles refused keys identically.
- Put settled failed turns in Hiljaiset with the existing failure marker, rather than leave them in Käynnissä or invent a failure section. This meets the explicit stop-counting requirement without changing the prototype's sign-in UX. Crashed/cut processes and failed workers remain visible as before.
- Keep current auth-classification asymmetry for part 2: `modelAuthFailure` matches `Invalid API key`, but not `Failed to authenticate`. Consequently the key case already has the existing provider-auth-error notice, while this OAuth case does not. Expanding classification/adding recovery guidance belongs to `proto-ai-sign-in-expired`; this fix changes neither.

## Verification and review

Tested working diff on base `0d5ce3296a9624a9946177763d52803b301ec021` (the implementation committed with this result):

- `npm ci --prefix web`; `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`.
- `./scripts/test-focused.sh --area web`: static/type checks and 169 files / 1265 tests pass.
- Named browser specs, each through `test-focused.sh --area browser --spec ...`, `OH_PORT_BASE=11700 OH_BROWSER_WORKERS=2`: `auth-failed-turn` (2), `rail-groups` (2, includes a11y), `rail-archive` (2), `rail-running-after-done` (1), all pass. New fixtures use exact observed provider text/error/stop and test live arrival plus reload and rail membership.
- `git diff --check`, `python3 scripts/validate-project-view.py`: pass. `issuectl doctor --json` completed (existing repository image/large-artifact advisories; no malformed fields or broken references).
- `go test ./test/browser-host`: pass. Focused wrapper rejects non-internal Go package paths, so direct Go was necessary. No production Go changed.
- Independent `/llm-review` with claude-fable-5-1, two calls (one context follow-up), local `/assess-findings`: no remaining confirmed defects. Removed a proposed endsTurn change to preserve retry grouping; checked recorded absence of text deltas against a speculative live-tail concern. A formatter failure during review was repaired; final web checks pass. Reports under ignored `history/review-ai-sign-in.md` and `history/assessment-ai-sign-in.{json,md}`. No review issues filed.

Initial multi-`--spec` invocation only selected the final spec; reran all named specs individually. Exploratory searches for nonexistent dist/component paths were corrected. Full gate/whole browser suite deliberately not run. Evidence is native invalid-credential/provider behavior plus host-backed synthetic browser behavior, not live installation acceptance or UID isolation. General partial-text streaming followed by an unrelated provider error was not reproduced in this task.
