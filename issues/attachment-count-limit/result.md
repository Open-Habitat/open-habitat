# Result

Browser and daemon now accept 30 distinct attachments per message, refuse 31, and retain all accepted files rather than truncating the upload loop. Finnish and English refusal text names 30. Explain-mode helper text no longer advertises a limit before it is reached. Contract description and generated fingerprints updated.

## Decisions for later review

- Kept the pre-existing **20 MiB combined prompt attachment limit**, in addition to the explicitly retained 20 MiB per-file and 1 GiB directory limits. Alternative: remove/raise the aggregate bound. This issue requests a count increase, not a byte-budget change; preserving it avoids silently increasing native image payload memory use. Thirty small files work; a set over 20 MiB still receives the existing size refusal.
- Did not regenerate the entire checked-in agent UI reference corpus: release packaging generates it from current catalogs; a local refresh would incorporate unrelated existing drift.

## Validation

Tested the working diff based on `13a31034056cc89e25d268a7f5d66ceeda053d7d`:

- `./scripts/test-focused.sh --area web`: 188 files / 1408 tests pass, static checks pass.
- `./scripts/test-focused.sh --area contracts`: generated bindings clean; 96 schemas, 149 fixtures, 43 scenarios and negative checks pass.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=24600 ./scripts/test-focused.sh --area browser --spec attachments.spec.ts`: all 3 pass. New boundary journey refuses an initial batch of 31, accepts 30, refuses another file without losing the draft, and sends all 30 through the real synthetic daemon. Existing attachment journey includes accessibility checks.
- `go test ./internal/daemon -run 'Test(Attachment|PromptAttachment)' -count=1`: pass, including 30/31 distinct-reference boundary and duplicate-reference behavior in both image modes.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: first run lacked Python schema packages on PATH. Retried with a disposable uv environment containing requirements-ci.txt: only unrelated `TestAgentCommandPathIsPerHomeAndInherited` fails because its expected PATH omits installed core `agent-bin`. Reproduced that exact failure in a clean archive of the base commit and filed unlaned `agent-path-test-misses-core-tools`. No product or test workaround included here.
- Independent `/llm-review`: claude-fable-5-1 finder and gpt-6-astra narrow size/quota/path verifier, followed by `/assess-findings`; no actionable findings. Local scratch reports are `history/review-attachment-count-limit.md` and `history/assessment-attachment-count-limit.{json,md}`.

After rebasing onto other workers' landings (only KOKEILTAVAA had a textual conflict, resolved by retaining main's entries plus this issue's line), reran checks on `b2646e805d0b7f1c8439550183def8d9b95b941f`: web 189 files / 1422 tests pass, all three attachment browser cases pass, contracts pass, and attachment Go tests pass.

No full gate, whole browser suite, live provider or distinct-UID testing claimed. This is a count/refusal change without a layout change; no screenshot comparison was needed. Test-server tryout added under KOKEILTAVAA's Työn alla.
