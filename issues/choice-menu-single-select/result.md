# Result

Single-choice menus retain radio-menu semantics and now show a visible tick and soft selected-row background, never checkbox squares. The composer file checklist had globally styled the same `ah-choice-check` class and made the tick transparent. ChoiceMenu (personal/server language and recap scope) and the view-card duration menu now share separate single-choice classes.

## Decisions for later review

- Use a tick plus selected surface rather than radio circles: clearly marks one current choice without presenting empty boxes.
- When a publication's saved expiry no longer matches any duration counted from today, include its exact expiry as the selected option. Choosing it keeps the expiry unchanged. Alternative: leave nothing selected (the earlier implementation decision), or falsely highlight a nearby duration. This implements the new requirement without persisting a second duration record. Recompute proposed expiry dates whenever the menu opens.

## Verification and review

Focused self-review: inspected all ChoiceMenu consumers, shared CSS collisions, radio semantics, controlled values, keyboard/touch focus, duration date matching and no-op current-date action. No authority, contract or session-state changes.

On base b5befbe4e plus this run's changes, Birch, private disk-backed TMPDIR, umask 077, OH_PORT_BASE=15600, OH_BROWSER_WORKERS=2:

- `./scripts/test-focused.sh --area web`: Biome, TypeScript and 179 files / 1351 tests pass (OH_WEB_WORKERS=2).
- Separate focused browser runs: `settings-selectors.spec.ts` 2 pass (Finnish/English, 1440/1040/800/390/320 px, axe, keyboard and touch); `view-links.spec.ts` 2 pass (initial/current/new duration, later date with no matching preset, anonymous/private/public paths).
- Capture runs of both specs pass with OH_VISUAL_CAPTURE=1; they explicitly start synthetic lab fixtures. DSF 2 PNG + offline HTML pairs in evidence/. Reviewed desktop Language and duration images; no live data.

Initial checks caught formatting, unnecessary TypeScript suppression and missing matchMedia test stubs (fixed in the companion settings issue). Default eight-worker web runs intermittently timed out unrelated GitLabConnection/Integrations tests; full web passes with two workers. Initial capture attempts correctly refused a non-lab origin, then encountered the lab's different workspace id; explicit lab marker/origin and fixture workspace selection fixed both. Repeated --spec selected only the last spec; all specs were subsequently run separately. No full gate or whole browser suite run; no live installation tested.
