# Pi 1.3.0 upgrade evidence

Date: 2026-10-16. Product worker: `01m51cm201czaq0x974tdy0m7x`.

## Product changes

The daemon's trusted SDK manifest check, both embedded helpers and the disposable native test dependency now pin `@earendil-works/pi-coding-agent` 1.3.0. npm lockfile regenerated from the registry, with Pi's exact 1.3.0 internal dependency versions. Node remains the existing trusted 22.21.1 runtime, which meets Pi's >=22.19 engine requirement. The contract scenario names 1.3.0; public JSON schema shapes are unchanged.

The existing `ModelRuntime` login/status/model APIs and `SettingsManager` methods remain valid on 1.3.0. Real pinned-SDK tests exercise them rather than replacing them with a host-owned credential/config implementation. The browser's offline candidate list now offers the highest numeric generation of each exact luna/terra/sol/astra chat family. Preview aliases, other families and older generations are omitted. Listing never makes a model request or rewrites a saved default; selection validates the offered candidate and writes through Pi.

Pi's current JSON/RPC `message_update` omits `partial` snapshots. The daemon now consumes visible `thinking_delta` text without requiring the removed snapshot. Primary provider source inspection confirms that opaque signatures/redacted payloads live outside `delta` (Bedrock may emit the literal `[Reasoning redacted]` placeholder). Signatures and unchecked fields remain excluded. Re-emitting completed thinking would both reorder it after the answer and overflow the bounded live tail on ordinary long reasoning blocks; that intermediate implementation was rejected during review. Text/tool deltas, queue frames, acknowledgements and `agent_settled` remain compatible with the bounded transport. The real native RPC test exercises prompt acceptance, native history, naming, abort and state query against a synthetic HTTP provider.

## Validation

- `TMPDIR=/var/tmp go test -race -count=1 ./internal/daemon`: passed (27 s), including real pinned Pi RPC and model/device helper integration. Root-only trusted-runtime/UID scenarios retain their explicit skips on this unprivileged runner; this is not a new distinct-UID proof.
- `TMPDIR=/var/tmp node --test internal/daemon/pi-device-test/*.test.mjs`: all four passed. Disposable HOME, trapped synthetic device exchange, auth refresh failure redaction, parent-pipe cancellation, separate homes, numeric newest-family selection, native default readback, preserved native auth, and no unrelated API-key resolver execution. Gate now includes both helper test files.
- `./scripts/test-focused.sh --area contracts`: generated contract drift check and both contract/implementation validators passed.
- First full `OH_PORT_BASE=16000 ./scripts/ci-local.sh --json`: failed after 203 s. Web format/lint/types, 126 unit and 116 component tests passed. Browser: 162 passed, two intentional visual skips, one restart-recovery locator timeout. Go: only `TestExternalPiAppendReachesTwoStreamsAndNativeHistory` failed to start an inotify watcher during concurrent browser load; affected package had passed separately. Not a clean-gate pass and packaging/lab remainder did not run.
- Both first-gate failures passed immediately in isolation: `go test -race -count=1 ./internal/daemon -run '^TestExternalPiAppendReachesTwoStreamsAndNativeHistory$'` and the focused `browser-conversation.spec.ts` restart-in-place case with one browser worker. Host inotify `max_user_instances=128`; no sysctl or household process was changed. The reduced-concurrency full rerun (`OH_PORT_BASE=18000 OH_BROWSER_WORKERS=2 ./scripts/ci-local.sh --json`) passed the entire Go/contracts phase, web checks and 162 browser tests, with two intentional visual skips; another unrelated `stale recovery during continuation` browser locator timed out. That case passed alone (11.4 s). Gate still failed and had no clean receipt.
- A concurrently run final daemon check saw existing close-child termination timing and watcher-start failures under the browser load; a serial final `go test -race -count=1 ./internal/daemon` passed (38 s). No fixture timeouts, sysctls or unrelated production behavior were changed to hide these failures.
- Running the lab remainder separately: 22/23 passed; the unrelated pi-onboarding non-admin account-menu focus assertion timed out. After conflict-free rebase onto source main, final checks on implementation commit `2a747683` all passed: four real-SDK helper tests; full daemon race suite (21.9 s); generated contracts and validators; three affected browser cases (restart, stale continuation, unsupported model; 9.6 s); all 24 lab cases (including the prior focus timeout; 1.4 min); and the gate's remaining packaging phase run separately (synthetic native fixture, two byte-identical archives, archive/socket checks, relocation verification, tamper rejection). Archive SHA-256 `d2e93dbc5cb1e6a2e1ddbabdb3f00c4c3f3f43f1b06f88434e5d79cac4daa1ca`. This is final focused plus phase evidence, not a passed full clean gate.
- Optional offline `test-real-pi-controller.sh`/VM distinct-UID proofs were not rerun; they need separately cached rootless guest artifacts. Neither local same-UID tests nor the native SDK guest probes are represented as a signed-in browser or independent cross-user attack proof.
- `python3 scripts/validate-project-view.py`, `git diff --check`: passed. Tracked source search `git grep 0.85.1 -- internal contracts web scripts`: no matches. Historical issue evidence remains historical.

Heavy runs checked `free -g` first (available memory 8 GB initially, 7 GB before retry), always using disk-backed `/var/tmp` for build scratch. No global Pi install or alder default was changed by this worker.

## Review

Completed `/llm-review` (critical: mapped-user secrets/release integrity) and `/assess-findings`: finder `claude-fable-5-1`, fresh verifier `gpt-6-astra`, two calls. Two confirmed regular-impact defects in the intermediate final-only thinking implementation were fixed: >4096-byte completed blocks invalidated the live tail, and delayed thinking appeared below the streamed answer. Primary journal/frontend source confirmed both. The smaller fix forwards native visible deltas in order and ignores completed snapshots; regressions cover 8192 aggregate bytes and opaque signatures/redacted final payloads. Verifier inspected Anthropic, Bedrock, OpenAI shared responses (including both Codex transports), Google, Mistral and completions; ran actual JSON projector and helper/projection tests; no remaining finding. No review follow-up issues needed.

Scratch review/assessment: `history/review-upgrade-pi-1x.md`, `history/assessment-upgrade-pi-1x.{json,md}`. Durable conclusions are above because scratch does not survive cleanup. Optional `/assess-models` corpus write failed once (exit 3: SSH-to-self publickey/password denied on alder); no corpus entry is claimed. This is the existing Fleetrepo `assess-models-alder-self-ssh` problem, not an incomplete review.

## Test guest

Fleetrepo delegated run: `01m51cn7nb6p6q5cv2t7hc0rxh`, source Fleetrepo main, capable/headless. Its scope is the reproducible guest runtime/selector pins, focused operator tests, native mapped-user family probes/default, retained login and restart recovery. Product and Fleetrepo retain the existing truthful pushed-main-only release route; no feature-release bypass was added. A signed-in browser turn is intentionally left for Jari after the main watcher deploys the matching product.

The Fleetrepo run completed and landed (`taskfleet run wait`: done, merged/landed true, no attention required). Durable receipt: Fleetrepo `infra/open-habitat-test/GUEST-PI-130-RESULT.md`; operator commit `3960bd95`, evidence commit `309950a4`. Pi bundle SHA-256 `c3fd21862872cec6a74ec19fd49d7d62dbb239599e3e5a9b4715b6a65da722bf`; 118 npm signatures and 34 attestations verified; 240 offline tests passed.

Live guest mapped UID/GID 21032 (`maintainer`) reports CLI `1.3.0`. The forced native catalog refresh succeeded and existing `openai-codex` OAuth answered on all newest family candidates:

| Family | Actual newest ID | Reply | Time |
| --- | --- | --- | --- |
| luna | `gpt-6-luna` | OK | 1198 ms |
| terra | `gpt-5.6-terra` | OK | 1099 ms |
| sol | `gpt-6.1-sol` | OK | 1434 ms |
| astra | `gpt-6-astra` | OK | 2159 ms |

No `gpt-6-terra` was present. Each bounded native SDK request used no tools/session, maxTokens 64, minimal reasoning, retries 0, 45 s cancellation; 24 input/5 output tokens per reply. The mapped user's native default was saved with `SettingsManager` as `openai-codex/gpt-6.1-sol`. After restarting only that guest user's daemon, a fresh mapped-user process read the persisted default and OAuth, and answered OK again. Full runtime/selector tree verification passed after restart; daemon/gateway/broker active; public root HTTP 200. All 10 prior session JSONLs remained byte-identical. Auth remains only `openai-codex`, mode 0600; no credentials were copied or exposed. No thinking preference changed.

Recovered delegation failures: new unit-test fixture initially observed the host's Node, then was corrected and all 240 tests passed; guest staging initially preserved transfer UID 1000 and correctly failed preflight before mutation, then exact staged hashes/ownership were repaired and install/verify passed. These are disclosed in the Fleetrepo receipt. Product admin readiness returned foundation-only rather than a meaningful per-user readiness proof; it is not claimed as successful browser acceptance.

The native probes ran while product pilot.126 still preceded this compatibility change. Product watcher deployment and a signed-in browser turn remain distinct from native proof; the latter is deliberately left for Jari. No feature-release bypass was added to manufacture pre-merge product evidence.

## Decisions for later review

1. **Retain the legacy provider, no token migration.** Browser onboarding and selection stay on `openai-codex`. Existing native sessions/defaults retain provider identity; `openai` is a separately configured native provider, not an alias. An openai-only browser onboarding flow is not implemented. This avoids conflating distinct auth/catalog/request routes during a runtime upgrade.
2. **Filter candidates, do not infer entitlement.** Only the newest numbered chat candidate per requested family is offered. A list request performs no billable probe and no fallback/replay. Missing families are omitted. Full picker UX and provider-qualified selection await the model-discovery design evaluation.
3. **Adapt to the actual delta-only wire.** Visible thinking still streams in native order; opaque signatures and encrypted payloads never enter the projection. Provider source evidence, not the old missing-snapshot check, establishes that separation. A regression test covers long aggregate reasoning followed by a large final block without duplication, overflow or answer reordering.
4. **No tool-policy rewrite.** Run native CLI RPC with the user's Pi resources/trust and explicit existing ownership fences. Do not silently enable codemode/MCP, disable people's extensions, or create a separate host configuration store. Pi 1.3's fullscreen default does not affect explicit RPC mode.
5. **Configuration proposal, not a new settings backend.** [config.md](config.md) identifies native files/API ownership, current browser abilities and future contract needs for thinking, provider-aware login and executable-resource changes. Alder's installation/default is the separate Fleetrepo worker's responsibility.

## Closing sequence

The worker's final `taskfleet run merge` tears its session down. A one-shot transient user service carries that exact merge, the required fetch/rebase/non-force main push, watcher-receipt verification and issue closure through teardown. It touches only this issue's evidence after a verified product release and uses explicit git staging. It waits boundedly for unrelated main edits without stashing or committing them. Local continuation log: `/var/tmp/upgrade-pi-finish.log`; verified deployment receipt summary: `/var/tmp/upgrade-pi-deployed.json`. If that continuation fails, it notifies Jari instead of claiming deployment or silently closing the issue. No household service is restarted by the continuation.

## Urgent deployment incident

Before compatibility merged, the watcher deployed old product `de2cce4ee0411f65ef5ff43aae4c0490dda17e04` as pilot.127 against the newly selected Pi 1.3.0. Its switch failed at 03:54; the watcher correctly stopped after a post-stage failure, and the conductor observed public 502/gateway refused. This is an upgrade sequencing failure, not a successful product rollout. Recovery is delegated to Fleetrepo run `01m51dq3brrg70rmckh5dp6aa2`: inspect/authenticate guest selector and partial stage, repair or remove exact partial state, archive inspected failed local summary/release state, then restart/reconcile watcher against pushed compatible product main. The closing continuation pushes compatibility immediately and waits for that run and a verified deployment receipt before closing the issue. Recovery's public-200 notification is required; no signed-in browser turn is claimed.

## Post-merge deployment

Product main was pushed without force and the existing test watcher verified 0.0.0-pilot.127 from `41ffc96e4687235ab7f387e6ae897cd973c79894` (requested source `41ffc96e4687235ab7f387e6ae897cd973c79894`, gate ungated, acceptance over_limit). Operator receipt: `/home/maintainer/.local/state/open-habitat-test-watch/release-41ffc96e4687235ab7f387e6ae897cd973c79894/release-test-receipt.json`. This is authenticated release/runtime evidence, not a signed-in browser turn; that remains for Jari.
