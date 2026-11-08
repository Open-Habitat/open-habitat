# Result

Implemented the accepted in-place direction. The experimental card is off by default; labelled `markdown` and `md` fences get an eye in their own group below Copy. Preview uses the existing sanitized renderer, preserves the eye's DOM/focus and rail width, hides source-only controls, and keeps copying the exact source. Source view settings survive a toggle. Finnish and English catalogs and explain-mode cards are included.

## Decisions for later review

- Start each block as source, rather than automatically rendering it. The round's questions do not state an explicit answer to question 3; its before-click state and the feature's toggle description support retaining the current default.
- Long previews start capped at 22rem, with Show all/Show less, rather than always expanding. This follows the selected prototype. Unlike its hidden overflow, the capped document can also scroll: links and nested controls remain reachable instead of being focusable outside a clipped surface.
- Preview/expansion are local mounted-block state, not saved preferences. Reopening a conversation starts as source; streaming text updates preserve the current view. No new host storage or file creation.

## Verification

Final runnable tree checked before the feature commit (base `git` history is retained by that commit):

- `./scripts/test-focused.sh --area web`: passed, 189 files / 1410 tests, plus formatting, types and catalog checks.
- `OH_PORT_BASE=23700 OH_BROWSER_WORKERS=2 OH_VISUAL_CAPTURE=1 ./scripts/test-focused.sh --area browser --spec markdown-block-preview.spec.ts`: passed. Production components on a synthetic lab host, invented history and preferences responses; keyboard activation/focus, unchanged horizontal rail position, capped/expanded geometry, source return, tables and axe at 1440 and 390 px.
- Unit tests cover off-by-default, eligibility, raw-source copying, open-fence streaming updates, stable toggle identity and hostile HTML/URL handling.
- Paired 2x screenshot/static HTML evidence: `evidence/collapsed-{1440,390}.*` and `evidence/preview-{1440,390}.*`. Synthetic only; no live account or native provider evidence. Dark-theme visual review remains for live testing.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`: completed; doctor includes repository-wide image-format advisories.

Focused self-review: reviewed renderer reuse/sanitization, component identity during streaming, raw copy, feature default and rail restoration. No daemon, contract, session-state machinery or authority boundary changed; no independent model review was required.

After the first merge attempt conflicted with the web-links worker's imports and the shared test list, rebased preserving both features and current main's test-list removals. Fast web checks and the named browser spec passed again on rebased `bb2e663c1` (before this evidence-only note).

## Development failures resolved

The first unit assertion incorrectly expected a long-block control in a ten-line sample; changed it to assert restored native source. Browser geometry caught a real 6px rail shift when the selector disappeared; the rail now reserves its selector width. Evidence capture first refused the ordinary synthetic host, then the lab run used an ordinary-host agent id and timed out; moved to the lab fixture, its actual agent id and explicit marker-verified origin. Formatting was corrected before the final green runs. Initial case-sensitive file searches and one exact-text edit missed their targets; corrected without partial changes.
