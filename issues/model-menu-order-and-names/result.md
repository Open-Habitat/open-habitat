# Result

Vertical lists order capability **descending, most capable first: Fable 5.1 → Opus 5.5 → Sonnet 5 → Haiku 4.5**. Horizontal thinking scales remain **low → high, left to right**, like a slider, per the conductor's decision.

The menu and header chip share provider-matched display names. Explicit product ranks replace API/current-first ordering; the current model stays highlighted in its ranked position. Unknown models use metadata names, or an unavailable label instead of a raw-id label when metadata is absent. Native ids remain separately available as technical information.

Production `ConversationModelDetails` now has ranked/missing-catalog Storybook states. No message components, shared state, contracts or daemon changes. Reclassified the observed incorrect names/order as a bug so issuectl permits the requested `fixed` closure (it refuses `fixed` for improvements).

## Validation

Final implementation patch based on `8161cab4f9f89c1a354620921def8fd9fb08297c`; the fix commit carries the exact sources.

- `npm ci --prefix web`: passed.
- `./scripts/test-focused.sh --area web`: format, lint, typecheck, unit/component tests passed.
- `npm run build-storybook --prefix web`: passed.
- `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts --tag @model-controls`: 3 passed.
- `./scripts/test-focused.sh --area browser --spec lab-model-menu.spec.ts`: passed; names/order, current-row identity, vertical layout/viewport bounds, keyboard open/Escape focus restoration and axe in all four viewport/theme combinations. Thinking order unchanged.

Initial lint, screenshot callback typing, test-routing and transition-frame audit failures were corrected and rerun successfully; the terminal report inventories these and recovered capture-tool failures. No Go/contracts/full-gate checks were needed or claimed. Browser evidence is an isolated synthetic lab with catalog/history presentation seams, not live Claude/provider availability.

## Visual review

Compared with the accepted compact header prototype (`design-system/prototypes/rounds/2026-10-22-taidon-kutsu-siru/round.js`) and the issue's updated ordering decision. Existing token borders, selected-row accent, typography and responsive popup placement are retained; only the model-list axis changes. Reviewed all four captures: readable names, correct selection, no clipped rows, horizontal thinking unchanged. Screenshots are review material, not automated visual comparisons.

Each AVIF has an adjacent offline HTML snapshot:

- [Desktop light](attachments/menu-1440-light.avif) · [dark](attachments/menu-1440-dark.avif)
- [390 px light](attachments/menu-390-light.avif) · [dark](attachments/menu-390-dark.avif)
