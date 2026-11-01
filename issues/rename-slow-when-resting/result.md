# Result

Resting manual renames use pinned Pi 1.3.0's `SessionManager.open(...).appendSessionInfo(...)` without starting an agent or loading extensions. The existing native-history reconciliation, writer census, ownership lease and admission permit remain in place; the helper inherits the owner and workspace descriptors. Running and starting conversations keep their existing RPC/held-name paths. Native session_info remains the only durable name.

The browser overlays the requested name in the header and rail through the identity-scoped mutation layer. A refusal removes the overlay and the name editor shows its existing localized error. An uncertain reply triggers a receipt read, never another write. Successful writes carry their journal cursor so an older in-flight snapshot cannot revert the confirmed name.

## Diagnosis and measurement before changing the path

`nameByHand` delegates a non-live conversation to `nameHistory`, which previously launched `piArgs()` plus a full temporary RPC Pi and waited for `set_session_name`. This includes native runtime and extension loading, unlike an already-running Pi's rename. The journal's later `continue` in the report explains why the next rename could be the cheap live-RPC path; we did not inspect personal pilot sessions.

Measured with pinned real Pi, synthetic HOME/history and no provider use on Birch:

- Original RPC path with the product bridges and no slow extension: 353 / 349 ms.
- Original RPC path with a synthetic native extension whose top-level load waits two seconds: 2207 / 2149 ms. The regression intentionally failed because that extension ran.
- New native writer with the same extension installed: 166 / 95 ms, no extension loaded.

These establish the startup dependency and eliminate it; they are not live-pilot latency measurements. An initial `.mjs` fixture did not autoload; changing the fixture to Pi's supported `.ts` extension produced the measured reproduction.

## Verification

Base: `8776b2477fff54f0dcb0f7174ae5cff8e9a8d4b0`, plus this issue's committed diff. No full gate or whole browser suite run.

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: pass, 137 s. Includes the real-Pi `TestRestingRenameNative` and existing live/held/history-name tests. First attempt lacked Python referencing; installed requirements in a disposable uv venv. Next run had one transient `TestAgentConversationControls` writer-conflict failure; full retry passed.
- `OH_WEB_WORKERS=2 ./scripts/test-focused.sh --area web`: pass, 161 files / 1186 tests. Includes a reducer regression for stale snapshots. An early test reused frozen fixture objects and was corrected to model fresh JSON reads. Later eight-worker runs hit unrelated five-second test timeouts under shared-host load (load average 43); the two-worker run passed without changing those tests.
- `OH_PORT_BASE=10090 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --lab --spec lab-conversation-name.spec.ts`: pass, 2 host-backed synthetic cases, including axe, desktop and phone, delayed acceptance, refusal rollback, uncertain failure receipt, and reload persistence. The first attempt caught rail metadata bypassing the snapshot overlay; pending names now also overlay that derived rail view.
- `./scripts/test-focused.sh --area contracts`: pass; generation clean, 88 schemas / 134 examples / 43 scenarios. No generated contract files changed.
- Visual capture repeat with `OH_VISUAL_CAPTURE=1`: pass. `evidence/optimistic-rename.png` and `.html` show the rail updated while the name request is deliberately held. Inspected screenshot and offline HTML from the synthetic lab, no live data.

## Independent review and assessment

`/llm-review`: claude-fable-5-1 finder plus independent gpt-6-astra verifier, two calls. `/assess-findings`: four confirmed FIX findings, all addressed: uncertain receipt refresh, cursor ordering, absent-agent receipt stays unknown, fixed-code helper failure diagnostic. Raw stderr logging was rejected because service diagnostics must not carry native error text. No residual findings or follow-up issues. Detailed scratch reports are `history/review-rename-slow-when-resting.md` and `history/assessment-rename-slow-when-resting.{json,md}`; this summary survives worktree cleanup.

## Decisions for later review

- Use Pi's pinned native SessionManager rather than a full temporary agent for manual resting renames. Alternatives: keep cold RPC or hand-append JSONL in Go. The measured startup cost justifies bypassing agent startup; the native writer preserves Pi's entry/parent semantics without a second title store.
- Leave generated-history titles on their existing RPC path: they are not this manual-rename latency report. Synthetic fake-Pi fixtures retain their existing RPC seam; the new dedicated real-Pi test proves the production optimization.
- On uncertainty, read the host once rather than retry the rename. A missing conversation remains unknown, and no identity or authority boundary changes.

## Integration validation

Rebased onto `00b00c1e9289d7c772d3ebd8c1e9ceabb943d597`; only the shared KOKEILTAVAA list conflicted, and both workers' entries were preserved. The newly landed UI-reference check correctly detected these changed component sources; ran `python3 scripts/generate-ui-reference.py` and included the two generated references. Post-rebase daemon tests passed (119 s), contracts passed clean, web passed (161 files / 1186 tests, two workers), and the two browser cases passed (11.6 s). One browser attempt hit transient port 10130 contention; the listener was gone on inspection and the same prescribed port-base retry passed without killing any process. Project-view validation, issue doctor and diff checks passed. Captured HTML trailing whitespace was normalized without changing its content.

A second rebase onto `a66a1620f49851be51df52759432dcd677441a88` again only conflicted in the shared checklist. Regenerated four newly stale UI references from the integrated recap/view-address work as well. Contracts and focused native-name tests passed; the two browser cases passed (29.6 s), and final web checks passed all 1192 tests. A concurrent run again hit the existing SpinoffConversation five-second timeout; the immediate web-only repeat passed. No changes to that test or its component were made.

Live pilot acceptance remains: rename a resting conversation, reload, then continue it and verify the name remains. Separate-UID isolation and installed-host lifecycle were not retested by this bounded change.
