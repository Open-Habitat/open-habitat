# Reopened live case: paging metadata

## Outcome

The supplied conversation does **not** currently reproduce an oldest-page count/cursor error. No runtime paging rule was changed. The issue stays open pending a fresh-browser check; the prior completed checklist is not evidence that Jari's reopened report is fixed.

The new `seuraava-sivu-yha.png` screenshot is particularly useful: its footer says **Lataa seuraava sivu**. That string is absent from the current source and the JavaScript actually served through the live origin forward. It was removed by `1a139e98`. An already-open tab running older JavaScript is the leading explanation, not a proven observation of the reporter's browser. A selected release does not replace JavaScript already executing in a tab. We did not inspect or reload Jari's browser.

Recommended next check: reload the conversation in a fresh tab, load the older page once if offered, and check both ends. If the problem persists there, retain the tab's loaded asset URL and the metadata of its actual history responses. Do not collect message bodies. The installed/served build alone cannot establish what the old tab loaded.

## Live evidence (2026-10-16)

Used Fleetrepo's `infra/open-habitat-test/release_test.py` pinned SSH/admin helper, which authenticates the host key, exact guest hostname and root UID. Read-only requests ran as the configured gateway peer (`open-habitat-gateway`, UID 21003) against `/run/open-habitat/users/maintainer/daemon.sock`; root itself is not an authorized daemon peer. No gateway, daemon, Pi or household service was restarted. No provider turn or history write was performed.

Target: workspace `ws_5AKDogIQD9CyV4Mo3nc0CqNZkY9tcr33`, conversation `pi:7489fcb0-31b8-42db-b088-681a77424f07`. The first request observed selected source `651b2f927a45be92dde68ae8f6b70c4d1ae8bd29`; subsequent requests observed `58e596c102bca33109210c34131a70afac63019f`, as the existing release watcher advanced. Both contain `12471b59` and `1a139e98`. The native counts and type sequence were unchanged between observations.

Only paging/type metadata was output or saved. Native JSONL parsing selected type/parent relationships and, for the non-projected fourth record, its role (`system`); neither message text nor model identifiers, extension data, tool arguments or outputs were output. The header was used only for counting and was not projected as conversation content.

| Native type | Count |
| --- | ---: |
| session (header) | 1 |
| model_change | 1 |
| thinking_level_change | 1 |
| custom | 0 |
| custom_message | 4 |
| message | 45 |

All 51 non-header records form a linear ancestry. One `message` is the internal `system` prompt immediately after the settings; it is correctly omitted. Therefore the HTTP projection has **50** entries: two settings, 44 user/assistant/tool messages and four extension messages. Combining the first two settings into one visual row does not change the native cursor boundary.

With the browser's `limit=25`:

| Request | Entries | First / last key | older_complete | next_before |
| --- | ---: | --- | --- | --- |
| tail | 25 | e54e1419 / a40ab1e4 | false | e54e1419 |
| before=e54e1419 | 26 | 3252d8d5 / e54e1419 | true | absent |

The older page deliberately includes its boundary witness. `25 + 26 - 1 = 50`, not 51: there is no missing older content. The oldest page starts with the sole model-change entry and includes the thinking-change entry and first user message. `boundary_found` is true on both pages. `limit=200` returns all 50 entries in one page, `older_complete=true`, no cursor.

Raw metadata files:

- `live-paging-metadata.jsonl`: the two browser-sized responses, counts and native types.
- `live-paging-200-metadata.jsonl`: the single complete response.
- `live-entry-types.jsonl`: native type/parent-index sequence, projected kinds, and the omitted record's role. Native keys are retained only where needed as HTTP cursors/page boundaries in the paging files; synthetic tests use invented keys.
- `live-served-assets.json`: anonymous origin HTML's script paths and hashes, plus counts of old/new pager labels in those served scripts. No HTML or JavaScript body was saved. The app bundle has zero occurrences of `Lataa seuraava sivu` and two of `Lataa vanhempi historiasivu`.

The public edge request from the agent's Python client returned HTTP 403. The asset observation instead used the existing Alder origin forward, with the inventory's pinned CA and the correct TLS hostname (`curl --connect-to ...:443:127.0.0.1:18443`). This proves the bytes served by the origin, not edge/browser cache behavior.

## Regression coverage added

`internal/daemon/history_exhaustion_linux_test.go` builds an invented-content native chain from the real 51-record entry-type/role sequence. It exercises every growing prefix, including short histories, exactly 25 projected entries with a hidden prompt/header, 26 entries, and the full 50-entry projection. HTTP paging must retain its overlap witness, cover all and only projected keys, progress, and report exhaustion exactly when the initial model entry is reached. This passes without a daemon change; it guards the counting hypotheses rather than claiming to reproduce the screenshot.

`web/src/app/conversationStore.test.tsx` applies the observed 25/26 page shape with settings and invented keys, then reconnect/tail refreshes. The complete 50-entry window keeps no cursor. This extends the earlier regression to the live shape and would catch the pre-`12471b59` exhausted-cursor resurrection.

No cosmetic change or synthetic screenshot is needed: this work changes no rendered markup, tokens or runtime behavior. Jari's supplied images were inspected; no new live screenshot or content capture was taken.

## Validation

- `go test ./internal/daemon -run '^TestHistoryExhaustionWithLiveEntryTypeSequence$' -count=1`: passed all 51 growth prefixes.
- The wider `go test -race ./internal/daemon -run 'History|Native' -count=1` did not pass: the first run lacked the pinned `pi-device-test` npm dependencies (three native Pi cases failed); installed them with the gate's `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts --no-audit --no-fund` command. On retry those failures were gone, but `TestExternalPiAppendReachesTwoStreamsAndNativeHistory` could not initialize its watcher. This shared host has a 128-instance per-user inotify limit; resource contention is a possibility, not a confirmed diagnosis. No other session or service was stopped. The broad run is not claimed as a pass.
- Isolated Go race retry passed: `go test -race ./internal/daemon -run '^(TestHistoryExhaustionWithLiveEntryTypeSequence|TestPiHistoryNativePagesChunksAndReopen|TestTailPageLargeNativeFileAndByteCap|TestTailPageFollowsActiveNativeBranch|TestSystemPromptIsNotAnExtensionCard|TestHiddenCustomMessageSkippedByNativeReader|TestExternalPiAppendReachesTwoStreamsAndNativeHistory)$' -count=1`. This includes the previously unavailable watcher, the real-sequence case, 2500-entry paging, byte bounds, active ancestry and omitted records. It does not turn the earlier wider run into a pass.
- `./scripts/test-focused.sh --area web`: passed formatting, lint, typecheck, 145 unit tests and 133 component tests.
- With `OH_PORT_BASE=33400 OH_BROWSER_WORKERS=1`, `./scripts/test-focused.sh --area browser --spec native-history.spec.ts`: 10/10 passed; `--spec lab-conversation.spec.ts --tag 'exhausted older history'`: 1/1 passed, including short/reload, long/exhaustion, live-turn and recovery behavior. The first port-base 29600 attempt stopped before running tests because Playwright reported its Vite URL already in use; the separate-port retry passed without touching another listener.
- `issuectl doctor --json`: no parse/schema violations; existing PNG/large-binary advisories and the unrelated `superseded_by` unknown key remain. No issue metadata fields were changed.
- `./scripts/test-focused.sh --area contracts` passed generated drift and contract/implementation-map validators; `python3 scripts/validate-project-view.py` and `git diff --check` passed.
- Rebased onto `3ae27ac3`, preserving Jari's additional 18:12 comment and screenshot. Intervening commits change only issue/docs material, not the runnable inputs tested above. No full gate or release receipt is claimed; only tests/evidence and the reopened issue's body changed.

No new fix or live-browser success is claimed. The supplied session has grown since the screenshot; these reads establish its current metadata, not the historical responses or code held by that tab.
