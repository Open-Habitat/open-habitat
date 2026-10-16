# Model choice: Käytön merkit

Implemented against Pi 1.3.0 after `taskfleet run wait 01m51cm201czaq0x974tdy0m7x --output json` reported done/merged, then rebased onto current main. No daemon or contract edits preceded that wait/rebase.

## Behavior

One production `ModelPicker` presents Pi's `openai-codex` candidates, native supported thinking levels, and observations from the mapped person's native sessions. Settings writes Pi's own global and per-model thinking defaults through SettingsManager and reads them back. New-session model/thinking choices use native startup flags, without changing the default. The inline unsupported-model picker offers an explicit new conversation and an initially checked default checkbox. It does not resend any message. The top-bar disclosure uses the same explicit-new-session fallback. A freshly created empty conversation also has a composer disclosure; changing its model starts a replacement session explicitly, rather than mutating the already-running Pi.

The catalog is offline/native-cached, not an entitlement list. On auth/catalog failure the helper still reads native settings, and the daemon offers only models observed in the bounded native window. Starting/saving a model still requires a native catalog validation; history does not grant authentication or entitlement. No probes, host catalog/history store, persistent observation cache, or gateway credential reads were added.

## Native evidence and bounds

Pi 1.3's AgentSession persists assistant `message_end` through `SessionManager.appendMessage`, including error messages. The real pinned-SDK test appends a synthetic unsupported assistant message and verifies the persisted provider/model/error/timestamp. Go derives only fixed `answered`/`refused` outcomes, never returning provider error text. Rate-limit, auth, aborted and empty responses do not become refusals or successes. Newer classified evidence wins. Each request rereads native files.

Discovery reuses the bounded native scanner (512 directories, 4096 session files and bounded headers). Observation parsing reads at most the 32 most recently modified sessions and 512 KiB of complete trailing entries per file, at most 16 MiB, with a two-second parsing budget. Symlink files, nonregular/foreign-owned files, incomplete final appends and changed files are not evidence. A missing observation means not tried **within this recent window**, not a claim about all historical use. No native file is written by the observation reader.

Synthetic measurements on alder: one 840,543-byte session, bounded tail scan **3.26 ms**; benchmark of 32 roughly 528-KiB sessions (three iterations), **17.83 ms/op**, **1.19 MB allocated/op**. These measure the history derivation, not the separate native Node catalog-helper startup. No personal histories were read for testing.

## Decisions for later review

- **Same-session switching is not enabled.** This work has not established a safe native RPC model/thinking switch across active turns, acknowledgement loss and reconnect. The existing controller's RPC allowlist has no model-setting operation. Rather than adding an unproven mutation, both chip and recovery offer “Aloita uusi keskustelu mallilla X”, the task's permitted fallback. This is not a claim that Pi lacks switching APIs. No user message is copied or replayed, even on an explicit model choice; any unsent draft remains attached to its old conversation.
- **Refusals age after seven days.** The prototype demonstrates a selectable twelve-day-old refusal but does not define a threshold. Seven days is an explicit presentation policy, not entitlement. Date and refusal text remain visible after expiry.
- **Family parsing is extensible.** Numeric version components are compared as integers (`6.10 > 6.9`); any `gpt-<version>-<family>` family can appear without a host release. Superseded versions and legacy pre-6 models are collapsed, except the newest member of each named family: the real Pi catalog has **gpt-5.6-terra**, not the prototype’s invented gpt-6-terra. That Terra stays offered. New family suffixes at generation 6 or later follow the generic naming rule. Unknown naming conventions remain offered rather than being silently discarded. All candidates remain selectable subject to current refusal marks.
- **Thinking is native metadata.** Pi AI's pinned `getSupportedThinkingLevels` supplies the levels, including `max` when supported. Unsupported levels are disabled; changing model clamps to an actual supported level. Settings uses both Pi's default thinking and its per-model setting so native SSH startup sees the same choice.
- **No invented freshness or “Uusi” detection.** The picker says the cached catalog may be outdated. There is no trustworthy account freshness timestamp or previous host catalog against which to claim a newly discovered family. New families simply appear as untried.

## Prototype comparison and deviations

Source specification: direction 1 in `design-system/prototypes/rounds/2026-10-16-mallit/round.js` and `round.css`, not built HTML. Production reuses its row/grid, word+icon+colour marks, family disclosure, adjacent thinking segments and phone sheet composition, with existing project tokens and real metadata rather than invented model capabilities.

- Native radio inputs and a native details disclosure replace the prototype's scripted radio-role buttons/popover. They provide keyboard behavior without a new modal/focus-trap abstraction. The top-bar picker refreshes when opened; recovery mounts inline. Settings changes wait for native acknowledgement.
- The host already starts a native process before its empty composer appears. In that composer, the safe fallback explicitly starts a replacement conversation; the pre-start workspace view can choose the model before starting. This differs from the prototype's purely browser-local unsent conversation.
- No retry/resend button or model-change marker is invented: those would falsely imply an in-session switch. The original native thread remains unchanged.
- API-key and Claude groups are explanatory, not fake setup actions. This issue does not implement API-key onboarding or Claude as an agent, so it does not claim that no key exists or offer a nonfunctional “Lisää avain” button.
- Real Pi catalog ids, capabilities and current observations replace synthetic GPT-6 entitlement/capability assumptions. Unknown native defaults are shown explicitly, not silently replaced.

## Verification

- Focused web type/lint/unit/component checks and daemon/contracts package tests were run during implementation; browser tests cover settings default persistence, collapsed older rows and stale-current expansion, explicit per-conversation choice without changing native default, and unsupported-model recovery without replay.
- Pinned Pi 1.3 native helper/SessionManager tests pass (synthetic homes and network trap).
- The bounded native-history benchmark and unit tests cover version ordering, future family, classified errors, success, aborted/rate-limited/empty messages, fresh rereads, file symlinks and tail limits.

### Focused final evidence

`./scripts/test-focused.sh --area web`: 126 pure app tests and 118 component tests pass, plus format/lint/typecheck. Focused browser selection (`Pi default model|unsupported account model|explicit new-conversation choice|empty composer replacement|refused defaults|warm controlled return`) passes six host-backed cases; the lab unsupported-model/recap recovery case also passes. Native Go model tests and the real Pi RPC synthetic-provider test pass. The latter now verifies native model/thinking startup flags in saved history and byte-identical global settings after the turn, not only mocked CLI args.

A visual journey caught an additional pre-first-message bug: an explicitly selected session could be blocked by a different refused global default because Pi has not written history yet. The controller now retains **per-child launch intent** in its existing in-memory handle and returns the schema-validated `startup_choice` on create/list/status. Native history takes precedence; no default, history or cache is persisted by the host. Browser regression covers an explicit working choice while the native default is refused, including reload before the first message. Until native history exists, the chip/picker uses that launch intent, not a guess at the global default.

The initial full gate passed Go/contracts, native SDK, web and packaging prerequisites but failed one browser assertion that prohibited every API read on warm return. The new empty composer deliberately reads the native default/marks. The test still prohibits all status/history/recap reads and reopened event streams, while allowing at most two model-discovery reads across the intermediate workspace route. This preserves its distinguishing warm-history regression rather than deleting it.

### Review and assessment

`/llm-review` plus `/assess-findings`: finder **claude-fable-5-1**, independent verifier **gpt-6-astra**, two calls, four confirmed FIX rows, all corrected:

1. A selected refused default could bypass its radio block by clicking a supported thinking level. Both the thinking controls and the choice handler now enforce refusal; the browser regression exercises a native refused default.
2. Observation-only fallback rows offered explicit writes that native catalog validation would reject. They and their confirmation action are now disabled while remaining readable with a reason.
3. Replacing an empty native session left the old child alive until the four-child capacity filled. Successful replacement now asks the daemon to close the old session through its authoritative emptiness/writer checks; failure is visible. Four repeated replacements leave one controlled native session in the browser test. An already-full controller still needs a free slot to create a new session; replacement is not an atomic native model switch.
4. Create called the full picker pipeline, unnecessarily reading recent histories just to validate a model. It now calls the separated catalog-only helper. The measured observation cost is ~18 ms, not an ordinary multi-second delay.

The verifier corrected two finder overstatements (the exact capacity-trigger count and an error-message claim), and narrowed the performance claim to measured bounded wasted work. No unresolved finding warrants another issue. Scratch: `history/review-model-choice.md`, `history/assessment-model-choice.{json,md}`. Their durable conclusions are above. Optional model-performance logging was attempted but failed with SSH-to-self permission denied on alder; no corpus write is claimed.

### Visual evidence

`visual/` holds **24 paired AVIF/static HTML captures** of the production components in the synthetic lab: desktop 1440×1000 and phone 390×844, light/dark, settings, pre-start choice, chip and inline notice. Phone scrolling panels also have action/bottom captures. Each was captured from the loopback lab with invented identities/homes; no live data or personal profile was used. Rows, marks, thinking segments, family disclosure and phone sheets were inspected against direction 1 source. AVIF conversion was done in a disposable `/var/tmp` virtualenv, not the machine’s persistent Python environment.

The existing settings page remains labelled “OpenAI (Pi)” rather than introducing the prototype’s future Agentti navigation. The existing actionable-notice region keeps its bounded 40-vh scroll so an arriving recap cannot displace the recovery action; top and bottom captures show that scroll, rather than pretending the whole picker fits at once. This is the notable layout deviation from the unbounded prototype. Phone chip sheets scroll to their actions. Native SVG marks replace text glyphs to avoid missing checkmark characters in the bundled font.

Real provider entitlement and live SSH/browser agreement remain checks for Jari in `KOKEILTAVAA.md`; synthetic tests do not establish either. The final gate and deployment receipt are appended during closing.

## Final clean gate

`OH_PORT_BASE=28900 OH_BROWSER_WORKERS=2 ./scripts/ci-local.sh --clean --json` **passed**, with no phase reuse, on commit `7ccab65edbeee078e35ed95e9c4fed00c6dacdeb`, tree `580438b0ab3a22d91cd6a98df409303712efae90`. The clean-tree receipt is in the shared git directory's `open-habitat-gate-receipts/580438b0ab3a22d91cd6a98df409303712efae90.json`. Total 270 s: dependencies 12 s, web checks 14 s, browser phase 228 s concurrent with Go/contracts 54 s, packaging 10 s. It includes 126 app tests, 118 component tests, 166 normal browser cases, 24 lab cases, all Go packages/race checks, native SDK tests, 31 schemas/10 negative checks, generated drift, docs, Storybook and package verification. The two normal browser skips are the existing opt-in visual captures; the 24 paired captures in this issue are human-reviewed evidence, not automated visual comparisons. `free -g` showed 8 GB available (3 GB free) before this run. Build scratch stayed on disk-backed `/var/tmp`.

This final evidence/closing-note commit changes documentation only after that tested runnable tree. It does not claim a clean-gate receipt for a different tree. The disposable watcher deployment remains explicitly ungated, as allowed by the project.

## Closing sequence

`taskfleet run merge 01m51djf7yx1ptgdnwqxq759gh` ends this worker. A one-shot transient user service carries that exact merge, the required fetch/rebase/non-force main push, verified watcher/operator receipt checks, and final issue closure through teardown. It waits boundedly for unrelated main edits without stashing or committing them. Only this issue's own status/evidence are staged after a verified deployment; signed-in/browser/provider checks remain for Jari. The continuation's receipt-validation path was exercised read-only against already verified pilot.129 and public HTTP 200 before starting it. Its local log is `/var/tmp/model-choice-finish.log`, with verified release summaries `/var/tmp/model-choice-deployed.json` and `/var/tmp/model-choice-final-deployed.json`. A failure notifies Jari and never claims an unverified deployment or blindly retries an ambiguous guest stage. No household service is restarted.
