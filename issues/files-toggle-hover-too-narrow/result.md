# Result

The top bar's file toggle now widens with its count. `ControlButton` treats a label without letters as an icon label and draws it as a fixed square (`presentation: icon`: width = height, no padding). An icon plus `11` therefore spilled past the hover and pressed surface. `.ah-files-toggle.ah-button` in `web/src/components/FileOffer.css` overrides the square: `width: auto` and an `--ah-s2` inline padding. Two- and three-digit counts now sit inside the surface, and the button stays quiet (no tinted resting surface).

## Decisions for later review

- **Fix in the toggle's CSS, not in `ControlButton`.** Alternative: count digits as text in `hasText`, which would make every digit-labelled button a `text` button with a tinted resting surface. Rejected because the files toggle sits among quiet icon buttons in the top bar, and the change would restyle any other digit-labelled control.
- **Inline padding `--ah-s2` (8px), not the row role's 12px.** With 12px the toggle looked like a text button among the square icons. 8px keeps the count clear of the surface's edge at 11 and 111.

## Verification

- `agent-file-offers.spec.ts` (package-card case) now offers a second folder, waits for the count `11`, and asserts the count's box stays inside the toggle's box. This assertion failed before the CSS change (`count.x + count.width` > the button's right edge) and passes after it.
- `./scripts/test-focused.sh --area browser --spec agent-file-offers.spec.ts`: 5 passed. `agent-views.spec.ts`: 3 passed. `lab-start-page-goal.spec.ts`: 2 passed. `--area web`: passed.
- Evidence (Chromium, 1366×860, device scale factor 2, synthetic host, hovered toggle): `evidence/before-11-hover.png` and `evidence/before-111-hover.png` show the count spilling over the surface's right edge; `evidence/after-11-hover.png` and `evidence/after-111-hover.png` show it inside. The three-digit count was produced by rewriting the count text in the page for the capture only; the fixture offers at most 11 files.
- Focused self-review (CSS-only change, no daemon, contract or authority path). No whole browser suite was run; the conductor runs it on integrated main.
