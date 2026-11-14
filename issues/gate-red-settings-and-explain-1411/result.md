# Result

All four cases reproduced individually on the worker's unchanged main-derived baseline (`932080d4`). None was a load-only flake.

- Experimental features: `0b542e50` added two terminal experiments but left the browser inventory at ten. Added both IDs to the independent expected inventory; their off-by-default assertions now run too.
- Settings selectors, Finnish and English: `64752848` added the fourth, long high-contrast choice. The segmented row overflowed at 390px in Finnish and 320px in English. Settings now uses the existing single-choice menu, retaining all four choices. Browser coverage also selects high contrast, verifies the applied theme, then restores System. Component tests still prove external updates and blocked-storage behavior through the new control.
- Worker explanation: `d932f577` introduced `worker-model` without mapping it to the existing model-details card. Its handler opens the same read-only details as the conversation chip; Y06 now covers both.

## Verification and review

- Each of the four requested cases passed **3/3 isolated runs**, focused runner, worker limit 2, fresh synthetic hosts, default seeded reply jitter.
- Complete settings-experimental and settings-selectors specs: 5 passed.
- Worker/helper explanation coverage at 1440 and 390: 2 passed.
- Fast web checks: 215 files / 1668 tests passed, plus static checks.
- Focused self-review: checked theme storage/change ownership is unchanged, existing choice-menu keyboard behavior is retained, model chip opens details rather than changing models, and new terminal cards are actually tested rather than merely increasing the count.
- Synthetic paired screenshots/HTML (kept privately, not committed) cover settings at 1440 and 390 in Finnish and US English. Visually inspected Finnish narrow and English desktop layout. No new card wording; worker mapping was verified by coverage, not a new visual card review.
- UI-reference generation and check passed. Its output included substantial pre-existing reference drift; generated changes were not retained (release packaging regenerates from source).
- No whole suite or clean gate run, no live installation accessed.

## Decisions for later review

Use the established choice menu for the four theme choices rather than shrinking labels, wrapping a segmented control or introducing a viewport-specific selector. This keeps every choice readable and reuses the same interaction as the adjacent language setting.

## Live check

On the test server, narrow Settings → Appearance to phone width and choose High contrast, then System. With Explain mode enabled, open a worker conversation and point at its model chip: it should explain the read-only model details.
