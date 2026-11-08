# Result

Removed only the helpers chip's visible label. The bots icon, marks and overflow count remain; the existing Finnish and English `help.head`/state messages in `web/src/text/backgroundStrip.ts` still supply its accessible name and tooltip. No catalog copy change was needed. The panel tab keeps its name. Helper selection and Explain-mode ownership are untouched (the separately assigned explainer worker owns that card).

## Evidence and review

- Focused self-review of the one-line production change: no selector, state, click handler, count or mark change. The shared ControlButton now supplies its icon-only QuickTooltip automatically.
- `./scripts/test-focused.sh --area web`: 193 files / 1448 tests passed.
- With `OH_PORT_BASE=12900 OH_BROWSER_WORKERS=2`, named browser specs run individually: `named-workers.spec.ts` (1), `helper-archive.spec.ts` (1), `worker-badges.spec.ts` (1), `worker-panel.spec.ts` (2), all passed. Named-workers includes axe and keyboard tooltip visibility, marks, opening and report readback.
- Synthetic lab capture `web/lab/helpers-chip-icon-only.mjs`: fi and en-US at 1440 and 390, device scale 2; paired offline HTML and AVIF under `evidence/`. Captures assert icon-only content and nonempty accessible name in both languages. Phone screenshot inspected. No live-host or separate-UID claims.
- `issuectl doctor --json`, project-view validator and `git diff --check` passed.
- Tested production diff against base `fb1c9c0db`: removal of the label span in BackgroundStrip. Full gate reserved for conductor.

Initial test attempts incorrectly expected a native title, then mouse-hover tooltip immediately after reload; the shared primitive uses QuickTooltip and the final test establishes keyboard modality before focusing, which passed. An initial multi-`--spec` invocation ran only its last argument; the others were rerun individually. Capture retries fixed lab lifetime (start/capture/stop in one shell), split the preferences API's one-change requests, and replaced earlier AVIF files explicitly after converter overwrite refusal. A scoped rg glob had no matching preferences source file; the contract provided the answer. The final web check first rejected the new capture script's formatting; Biome formatted that script and the repeated full focused web check passed. No production changes were made to work around these tooling mistakes.

## Decisions for later review

None: implemented Jari's exact requested change, retaining existing bilingual name/tooltip messages and mark layout.
