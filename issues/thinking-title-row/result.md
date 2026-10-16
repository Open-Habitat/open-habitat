# Thinking title row

## Cause and change

`ThinkingRow`'s multi-line branch rendered a fixed “Ajattelu” button and passed all Markdown into its hidden blockquote. This behavior dates to the original turn component (`3695255a`); inspection of its history found no intermediate title extraction that had been lost. The Agentin vuoro draft has the same generic disclosure. Jari's explicit correction in this issue supplies the missing title rule; the existing single-line, live-delta and redacted presentations remain unchanged.

A standalone leading `**…**` line is now the disclosure title: **Ajattelu · Interpreting extension messages**, collapsed or expanded. Only that heading line (and preceding blank lines) moves out of the body. The remaining Markdown is passed unchanged to the existing sanitized renderer, including further headings, emphasis, lists and whitespace. Each block owns its own title and disclosure state. Inline bold text, later headings and unfinished bold delimiters are not extracted. This is presentation only: no host, contract, native history or persistence changes.

The label and title occupy one row. A title longer than the available phone width ellipsizes rather than displacing the label or widening the page; the complete title remains the button's accessible name and hover title.

## Evidence and verification

`visual/` contains paired screenshot/static HTML captures from the synthetic lab at `OH_PORT_BASE=28100`, with invented reasoning supplied through the browser's validated history-response boundary. They reproduce both symptoms before the fix (missing collapsed title, duplicated bold heading in the expanded body), and show two independent titles afterward. This establishes production browser rendering, not real Pi/provider behavior or live-server verification. Jari's original screenshots remain unchanged.

- The new `thinking-title.spec.ts` was run with the original `AgentTurn.tsx`: **failed** at the missing titled disclosure, as expected. This is an actual regression check, not just a post-fix screenshot.
- Component tests cover CRLF/blank-line headings, preserving other emphasis, not extracting inline/later/incomplete headings, redaction and live deltas.
- The browser test covers both titles/states, independent toggling, keyboard activation, preserved body Markdown, no repeated title, desktop/phone row geometry and Axe accessibility.

Final focused checks, clean gate and closing revision are recorded below.

## Focused self-review

Checked that extraction is confined to completed multi-line thinking, no raw HTML path is introduced, the rest of the source string is sliced rather than rewritten, and no state is shared between blocks. Checked the title's bounded phone layout and complete accessible name. No unrelated model controls, workspace UI, settings or host code was changed.

## Final focused checks

`OH_PORT_BASE=28100 ./scripts/test-focused.sh --area web` passed format, lint, TypeScript, 131 app tests and 126 component tests. `./scripts/test-focused.sh --area browser --spec thinking-title.spec.ts` passed its host-backed rendering/keyboard/layout/Axe case. The Markdown lazy renderer exceeded Testing Library's one-second default during a loaded parallel run; these assertions now use the same ten-second chunk-load allowance as the existing Markdown tests. No renderer or production-loading behavior was changed to mask that test timing.

`issuectl doctor --json`, `python3 scripts/validate-project-view.py` and `git diff --check` passed. Reviewed desktop and 390px phone after captures; the title stays on the label row and the body no longer repeats it. Five paired AVIF/static HTML captures are retained (before collapsed/expanded, after collapsed/expanded and phone expanded). The new live checks are in `KOKEILTAVAA.md`; no live/provider check is claimed here.

## Clean-gate outcome

Ran `OH_PORT_BASE=28100 OH_BROWSER_WORKERS=2 ./scripts/ci-local.sh --clean --json` on commit `87d7ec445516b1efd3cf7e6d5f78410223f74302`, tree `30b12a4054794713206ac4aa34eca2c740027248`, after checking memory (5 GiB available). Build scratch was disk-backed under `/var/tmp`.

The gate **failed**, not passed: normal browsers had **173 passed, two existing opt-in visual skips, one failure** in `@conversation-details archive offer expires after eight unpaused seconds` (`browser-conversation.spec.ts:2736`), timing out waiting for the archive notice to disappear after clock advancement. This issue's browser regression passed. Web checks (131 app / 126 component tests), Storybook, all Go race tests, generated contract drift, 35 schemas, docs/licenses and offline VM recipe validation passed. The failed browser phase stopped the gate before lab and packaging; no clean-gate receipt or package verification is claimed.

The exact archive-expiry case **passed in isolation** with fresh production assets. All **12 lab-conversation cases passed** separately. Per the task's explicit unrelated-timeout exception, this is sufficient to land the scoped fix; the full gate remains non-green. No unrelated archive timer code was changed or finding filed on this one isolated passing retry.
