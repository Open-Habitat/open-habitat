# Result

The rail now offers × for an empty conversation, matching its header; once it has history it offers Archive. Creation gets a returnable row immediately, before the host reply/catalog. That row becomes the native row without duplication. Moving away and returning preserves the draft, including when creation completes while the view is unmounted. A definitively refused creation remains reachable and can be closed from either place; closing discards its local draft/held messages/guide and dismisses the refusal notice.

The baseline already listed a native-created empty conversation (the existing rail-now test passed before changes). The missing interval was before creation/catalog completion. No new draft registry was introduced: the existing draft adoption and sessionStorage remain the owners.

## Evidence

Tested on Birch from base `13a310340`, then rebased onto integrated main (`55c4fc6ee`) and reran all focused checks. The only conflict was KOKEILTAVAA: retained the other workers' entries and main's removal of the already-tested limit-reset entry.

- `./scripts/test-focused.sh --area web`: 189 files / 1,422 tests pass after rebase (188 / 1,408 before), plus static/catalog checks.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=18600 ./scripts/test-focused.sh --area browser --spec rail-now.spec.ts`: 4 pass, including rail a11y, pending navigation/draft adoption, native draft reload, close→disappearance, written→Archive, and refused creation discard.
- Same focused command with `--spec rail-archive.spec.ts`: 2 pass (desktop keyboard/hover and touch).
- Synthetic lab before/after screenshots and adjacent offline HTML in `evidence/`, 1440×900 CSS pixels at device scale factor 2. `web/lab/capture-new-conversation-rail-row.mjs` reproduces both creation-pending and native-empty views; all labs stopped.
- Independent review: claude-fable-5-1 finder and gpt-6-astra verifier; assessment fixed two low-severity findings (stale refusal notice and temporary Archive icon before catalog arrival). Source review rejected a new-data-loss claim: reload during unfinished/refused creation follows existing reconciliation, which preserves draft text but does not restore its temporary row. Working review/assessment are under ignored `history/`.

No Go, contracts, authority paths or native session protocol changed. No full gate/browser suite was run. Evidence is host-backed synthetic, not live-provider or separate-UID qualification. Explicit chosen-model startup uses the same creation handler but was not separately exercised; unfinished/refused creation reload behavior was not expanded.

Initial checks caught an unformatted capture script and a test locator that matched a fixture conversation after refresh; both corrected and final checks passed. A repeated `--spec` invocation ran only its last spec, so each named spec was rerun separately. Discovery searches included missing glob paths/no matches; no implementation dependency was skipped. Generated HTML trailing whitespace was normalized after the staged diff check caught it. Issue closure initially warned about missing acceptance criteria; checked criteria were added through issuectl. Issue doctor and project-view validation passed.

## Decisions for later review

- Put an in-flight creation in **Sinun vuorosi**, using the existing new-conversation name and row design. Alternative: wait for the catalog. The immediate row is the way back to an unsent draft.
- Until creation is confirmed or definitively refused, the row's Close is disabled: hiding an uncertain host creation would pretend cancellation succeeded. A refusal can be closed locally, with the same discard semantics as closing an empty native conversation.
- Reuse this tab's existing per-workspace creation and draft state instead of a second persisted registry. Native-created unsent conversations survive reload through the existing catalog/draft path; recovery of unfinished/refused creation across reload is unchanged.
