---
created: 2026-11-01
updated: 2026-11-01
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: Observed host-backed browser test failure, reproduced with baseline production source
source_ref: taskfleet:01m6bwp0tzsev1brh0pddgkpe0/observed:disabled-tooltip-region
originating_run: 01m6bwp0tzsev1brh0pddgkpe0
originating_run_kind: spinoff
---

# Disabled control tooltip produces orphan accessibility content

## Description

Hovering a disabled editor Save button opens an orphan tooltip that Axe reports as content outside landmarks (`region`, moderate; target `div[data-overlay-container="true"]`). This is visible in the accessibility tree as the save tooltip outside main. Disabled controls do not consume the ordinary tooltip trigger props; inspect `DisabledTooltipHover` and `QuickTooltip` in `web/src/components/QuickTooltip.tsx` and their trigger/description linkage.

Observed during editor-header-one-row: the shorter toolbar lands Save beneath the pointer during the phone layout/return journey. The untouched workspace-editor.spec.ts then fails its final Axe assertion in both phone themes, while desktop passes.

Confirmed independently on baseline production source 8776b2477fff54f0dcb0f7174ae5cff8e9a8d4b0: temporarily add `await page.getByTestId("editor-save").hover(); await expect(page.getByRole("tooltip")).toBeVisible();` immediately after the final send visibility assertion for phone cases in workspace-editor.spec.ts. Both phone cases fail with the same region finding (7 other cases pass). Without deliberate hover the baseline suite passes, so this is pointer-position-dependent rather than a new header semantic defect. Restore the temporary probe after reproducing.

Expected: hovering disabled controls should expose correctly associated help without orphan accessible content. Check both pointer and keyboard accessibility, with disabled and enabled controls. The header worker parks the pointer away before its final layout audit; it does not disable Axe rules or claim tooltip accessibility coverage.
