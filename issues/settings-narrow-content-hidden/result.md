# Result

Narrowing Settings from desktop through 1050 px keeps the visible Account section open, including when Settings was opened at `/settings` rather than `/settings/account`. The back row returns to the section list. The existing explicit-section behavior and phone entry into the list remain intact.

The root route previously displayed Account alongside the list but carried no detail flag, so the folded CSS correctly hid the content for that route. Crossing the boundary now replaces the root route with the displayed section's route; no second navigation store or breakpoint change is needed.

## Decisions for later review

- Replace, rather than push, the root route on narrowing: resizing must not add browser-history steps. Opening Settings while already narrow still opens the list, as before; automatically opening Account on every phone entry would prevent the intentional list screen.

## Verification and review

Focused self-review checked route ownership, listener cleanup, local Storybook state, the inclusive 1050 px boundary and list/search navigation. No authority, contract or session-state change.

On base b5befbe4e plus this run's changes, Birch, umask 077, private disk-backed TMPDIR, OH_PORT_BASE=15600, OH_BROWSER_WORKERS=2:

- `./scripts/test-focused.sh --area web`: Biome, TypeScript, 179 files / 1351 tests pass with OH_WEB_WORKERS=2.
- Separate browser runs: `settings-breakpoint.spec.ts` 2 pass; `settings-search.spec.ts` 5 pass; companion `settings-selectors.spec.ts` 2 and `view-links.spec.ts` 2 pass.
- Breakpoint regression starts at the formerly missed `/settings` route, resizes through 1280/1060/1051/1050/1040/810/390 and back, both rail states, and checks content, list, back, close and overflow. Existing direct section routes remain exercised by search/selectors specs.
- DSF 2 synthetic lab PNG + offline HTML pairs in evidence/, 1060/1040/390 px, both rail states; 1040 open-rail image visually inspected. Captures are review material, not automated image comparisons or live-server evidence.

After rebasing onto main 862189519, both commits replayed unchanged except KOKEILTAVAA additions (kept all workers' lines). Final integrated checks on 0ff63a51d: web 180 files / 1369 tests passed; selectors 2, breakpoint 2, view-links 2 and search 5 passed in separate focused runs. Project-view validation and issuectl doctor completed; doctor reports the existing evidence-format advisories.

A second merge-time rebase onto f9a116f72 brought the graduated server settings area. On d571ce6f8, web passes 180 files / 1370 tests; all three touched browser specs pass (6 cases). The untouched settings-search spec now has 4 passes and one obsolete server-key assertion failure; reproduced without this worker's changes from an archive of main and filed unlaned as `settings-search-graduation-expectation`. This does not block the two fixes.

Initial web run exposed the new listener's missing matchMedia stubs in Account tests; fixed the fixture. Unrelated Integrations/GitLabConnection tests intermittently exceeded five seconds at the default eight workers; the full web check passes at two. No full gate or whole browser suite run. Generated offline HTML retains browser-serialized whitespace; source diffs pass whitespace checks.
