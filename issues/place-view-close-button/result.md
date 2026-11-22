# Result

Both Tuotokset and Agentin käytössä have a header × using the existing rail return navigation. The shared PlaceHeader uses IconButton and design tokens; Finnish/English labels and Explain card J10 are included. No experiment is required. The close control remains available during loading, errors and phone detail views.

## Verification

Tested implementation: `72a6bc396d2dd0d6315c083479558b59c3ba26d5`.

- `./scripts/test-focused.sh --area web`: static checks, typecheck and all 255 test files / 2,157 tests passed.
- `./scripts/test-focused.sh --area browser --spec rail-place-toggle.spec.ts --spec agent-resources.spec.ts --spec view-links.spec.ts`: 13 passed.
- Final named Playwright run from `web/`, with `OH_BROWSER_WORKERS=2 OH_LAB_WORKERS=2 OH_PORT_BASE=14700 OH_REPLY_DELAY_MS=60`:
  - `npx playwright test tests/rail-place-toggle.spec.ts tests/agent-resources.spec.ts tests/view-links.spec.ts --repeat-each 3`: 39 passed.
  - `OH_VISUAL_CAPTURE=1 npx playwright test --config playwright.lab.config.ts tests/lab-place-close.spec.ts --repeat-each 3`: 12 passed.
- Runs used umask 077, bounded timeouts and the scratch lease. Initial missing Pi fixture dependencies were installed with the pinned lockfile. Early lab-test failures were test setup errors (combined preference updates, then an open phone drawer); corrected before the final passing runs.
- Browser assertions cover preserved conversation instance/draft/scroll, return from workspace and direct links, phone navigation and resource details, existing rail/Back/Forward/Escape behavior, Explain mapping and safe two-tap navigation. Existing place specs include axe checks.
- Visually inspected both places and the Explain card at 1440px and 390px in Finnish and US English. UK uses the same new copy. Paired synthetic screenshots and static HTML: `/var/tmp/agent-keep/place-view-close-button/{shares,resources}-{1440,390}-{fi,en-US}.{png,html}`. These are same-UID synthetic lab evidence, not live installation evidence.
- `python3 scripts/generate-ui-reference.py --check`, `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and `git diff --check`: passed.

No live deployment or full gate was run; neither is required for this focused browser-only change. No daemon implementation, session state, wire contract or authorization boundary changed.

## Review

Focused self-review was proportionate: checked the complete diff, callback routing, header availability across loading/detail layouts, mobile wrapping, catalog parity and generated reference changes. The existing navigation helper remains the sole return-path owner. An initial cramped phone header was corrected by placing its secondary action below the heading. No unresolved findings; independent model review was not required for this presentation-only change.

## Decisions for later review

- Keep the shared page header outside the content/list conditionals, rather than adding × only to the existing list headings. This keeps closing available when a request is pending or a phone displays details.
- Treat × as safe navigation in Explain mode, rather than a blocked destructive close: it only leaves the place view and preserves the underlying conversation.
