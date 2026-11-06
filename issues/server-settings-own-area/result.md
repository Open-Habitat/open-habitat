# Result

Direction B is implemented behind the account-wide, default-off **Palvelimen asetukset omana alueena** experimental card. Existing section URLs and admin checks are retained. The server area contains its seven sections and a return to personal settings; at phone widths the same route links form a horizontally scrollable tab-shaped row. No gateway, daemon, contract or authority change.

## Decisions for later review

- Kept existing `/settings/server`, `/settings/server-integrations`, etc. URLs rather than introducing a second route hierarchy. The selected section determines the area; bookmarks, row fragments, history and the account-menu entry keep working with the experiment on or off.
- Phone tabs are real navigation links with `aria-current`, not ARIA tabs: each opens a route, supports normal link actions and uses Tab/Enter. Selected links scroll into view. The alternative was a tab widget with arrow-key selection and tab panels; that would misrepresent these navigable pages.
- With the experiment enabled, personal settings search searches personal sections only (including the new experiment card). Server settings have the short complete list rather than a search field, as in B. The alternative was global live search that would leave the personal area mid-query. `/` returns to the personal search. This search-scope choice merits Jari's review.
- Return opens the personal section list on narrow screens and Account on desktop, matching the prototype. No extra last-section memory. General and Integrations use shorter names inside the server area, including their page headings.

## Validation and review

Focused self-review of the final diff, route selection, feature-off behavior, admin gating, focus and responsive layout. The original prototype was built with its `build.mjs` and direction B opened in Chromium. The new UI was inspected in synthetic captures below. No independent review was required: this changes presentation/navigation, not session state, daemon logic, contracts or authority.

On Birch, with short `/var/tmp/oh-r60.*` TMPDIRs, umask 077, `OH_PORT_BASE=12600`, `OH_BROWSER_WORKERS=2`, after both locked npm installs:

- `./scripts/test-focused.sh --area web`: static/type/translation checks and 170 test files / 1268 tests pass.
- `./scripts/test-focused.sh --area browser --spec server-settings-area.spec.ts`: 3 cases pass. Tests menu entry, all seven links fully in the 1440×900 viewport, exit/re-entry, history, direct section and row-fragment links, turning the feature off, phone overflow/keyboard focus, and non-admin denial. Navigation axe audits pass in desktop light and phone light/dark.
- Named regression specs run separately: `settings-experimental.spec.ts` (3), `settings-search.spec.ts` (5), `settings-close.spec.ts` (8), `settings-breakpoint.spec.ts` (2).
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`.

Evidence covers the implementation committed with this result (base `git` history plus this issue's Fixes-Issue commit). These are host-backed synthetic tests, not installed-host or Unix-UID isolation evidence. No Go/contracts changes, no full gate or whole browser suite. Safari/iOS and a real installation remain untested.

### Synthetic visual evidence

Screenshots at 2×, each paired with an inert HTML snapshot: `evidence/desktop-light.{png,html}`, `evidence/phone-light.{png,html}`, `evidence/phone-dark.{png,html}`. Reproduce with `OH_VISUAL_CAPTURE=1` on the new named spec; ordinary tests do not rewrite evidence.

### Recovered tooling failures

Initial file probes used two nonexistent guessed filenames and an absent checkout-local browser-cache path; corrected by reading actual files and using the installed Chromium cache. An exact edit was rejected as ambiguous and reapplied with unique context. Initial Biome/web checks found formatting and an effect dependency declaration; corrected before final checks. The first capture attempt used an ordinary synthetic host and was correctly refused by the lab-only snapshot guard; the spec now uses an isolated lab-mode host and passes its explicit lab origin. A command repeating `--spec` ran only its last value; the other three specs were then run separately. The staged diff check exposed trailing whitespace in generated HTML snapshots; normalized before landing. Visual review also caught that changing storage alone had left the supposed dark capture light; switched the test to the real system-theme path and asserted the rendered theme before recapture. The recapture exposed an unsized back icon crowding the close button; sized it with control tokens and added a phone non-overlap assertion. Biome rejected that assertion's initial non-null syntax, fixed with an explicit missing-element check. Web and the new browser spec passed again after these corrections. No failing step is counted as passing evidence.
