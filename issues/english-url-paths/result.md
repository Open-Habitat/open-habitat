# English URL paths

Implementation `505a762b`, test-fixture follow-up `6398169b` (final tested source): one JSON slug map feeds browser navigation and the gateway's exact OAuth return allowlist. Settings links, administration shortcuts, quota/trash actions, provider links, executable lab scripts and browser expectations use English paths; Finnish labels and internal section IDs remain unchanged. Editor deep links now also survive OAuth. Old Finnish slugs are unknown routes, not aliases.

Audited browser routing/query construction, gateway redirects and daemon-generated links/notices. Other generated path vocabulary and query keys were already English; user-owned URL values and external provider URLs remain untouched. No daemon, integration-dialog or contract implementation changed.

## Validation

- `npm ci --prefix web` and the synthetic Pi fixture install: passed.
- `./scripts/test-focused.sh --area web`: formatting, lint, TypeScript and 504 tests passed.
- `./scripts/test-focused.sh --area go --go-package ./internal/gateway`: passed, including exact OAuth return acceptance/refusal and editor return coverage.
- `npm run storybook:test --prefix web`: passed; settings stories now exercise real links with a MemoryRouter.
- Browser checks use `./scripts/test-focused.sh --area browser --spec <spec>`, one suite at a time on the configured remote synthetic runner. Passed: account-settings (13), browser-editor (15), phone-sign-in (1), integrations (6), lab-workspace-trash (1), lab-worktree-cleanup (1), lab-imap-dav-forms (1), lab-integration-inventory (4), lab-integration-progress (4), quota-pressure (1), lab-outage-account (5), lab-english-url-paths (1). These include affected accessibility checks.
- Browser-conversation: all 67 passed on final unchanged-source retry. Across the 13 affected specs, all 120 cases passed; earlier failed attempts are disclosed below.
- Project-view validator, issue doctor and `git diff --check`: passed. Doctor retains pre-existing repository image/binary advisories.
- No contract changes; contracts/full clean gate not required or claimed. No live deployment or distinct-UID security claim.

## Review evidence

`review/` contains paired inert HTML and AVIF captures at 1280 and 390 px, light and dark, using only synthetic Alice data. Inspected all four against the settings reference in `design-system/drafts/Navigaatio ja asetukset.dc.html`: Finnish identity/card presentation, theme treatment and compact phone layout are retained. This is a route-only change, not a redesign; no CSS or visual component state changed. The visible heading outline records the existing route-focus behavior. Images are human review material, not automated pixel comparisons.

Focused self-review checked every settings call site, the single shared slug source, exact gateway return matching (queries/fragments/traversal remain rejected), old-slug rejection, OAuth/editor restoration, history/reload behavior and the independent English-vocabulary regression test. No shared application state, daemon or contract changes required an external reviewer.

## Disposition

Closed as `done`: tracker schema reserves `fixed` for bugs. Both acceptance criteria hold. See [validation-failures.md](validation-failures.md) for every failed attempt, fixes and the final unchanged-source retry. All required checks completed; no unresolved validation blocker remains.
