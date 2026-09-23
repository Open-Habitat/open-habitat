# Frontend stack decision result

> Historical evidence (2026-09-22): this result truthfully records the TypeScript 6/ESLint trial. Jari's later decision selects stable TypeScript 7 with Biome and `tsc --noEmit`; current evidence is in `issues/apply-review-corrections/result.md`. In particular, `typescript-eslint` 8.70.1 declares TypeScript `<6.1.0`; that rejected graph must not be forced or retried.

## Outcome

Propose [ADR 0002](../../docs/adr-0002-frontend-stack.md): a client-rendered React 19.3.0 and strict TypeScript 6.0.3 application, built by Vite 8.3.0, with React Router for URL selection, one Redux Toolkit store for snapshots/SSE/command reconciliation, React Aria Components as the accessible primitive layer, existing CSS tokens plus CSS Modules, a sanitized React Markdown pipeline, Shiki token highlighting, an escaped parsed-diff renderer, virtualized long histories, Storybook, Vitest/Testing Library and Playwright/Axe.

The ADR remains **Proposed**. `review-implementation-plan` is the acceptance gate. No product runtime or host/backend choice was created.

## Decision matrix

Scores are 1 (poor fit) to 5 (strong fit) for this accepted UI, not general ecosystem rankings.

| Lens | React + TypeScript SPA | Svelte/SvelteKit + TypeScript | Server HTML/HTMX |
|---|---:|---:|---:|
| Snapshot/SSE/acknowledgement state clarity | 5 — Redux reducers and one connection controller fit replay/reconciliation | 4 — stores can model it, but an equally explicit convention must be designed | 2 — substantial custom client state would sit beside server fragments |
| Keyboard/focus and accessible primitives | 5 — broad React Aria behavior layer, plus native HTML | 3 — credible choices exist, but no evaluated whole matched React Aria coverage | 3 — native HTML helps, but DOM swaps complicate focus/live regions |
| Markdown/code/tool/diff renderer fit | 5 — maintained composable packages and React escape boundary | 4 — unified ecosystem is usable, with thinner framework-specific integration | 2 — rich streaming views still need a client renderer or repeated fragments |
| Long live histories and stable reading position | 4 — virtualizer is mature; variable-height accessibility remains hard | 4 — smaller runtime and virtualization options; same intrinsic difficulty | 1 — DOM swaps and server round trips work against local anchor/state control |
| Test/catalog toolchain | 5 — Storybook, Testing Library, Playwright and Axe integrate directly | 4 — solid Vite/Playwright support, somewhat less direct component reuse evidence | 3 — browser tests are strong, but reducer/content units need a separate JS design |
| Static Alder deployment | 5 — static output; no Node production service | 5 — static SPA output is also possible | 5 — could be integrated directly into the host |
| Dependency/runtime weight | 3 — the eager app trial was 510.16 kB minified / 159.98 kB gzip before the separately tested Shiki worker | 5 — likely smaller and less runtime code | 5 — smallest before the required custom client behavior is added |
| Maintainability for the accepted event-heavy UI | 5 — explicit owners and wrappers; more boilerplate | 4 — concise, but the complete accessible component/rendering whole is less proven here | 2 — would become a bespoke JavaScript application split across three owners |

React wins because the difficult parts are event reconciliation, accessible composite controls, untrusted rich content and browser testing. Existing JSX reduces translation cost but was not scored as architecture evidence. Svelte remains genuinely credible and would be the fallback if the React Aria/design integration trial fails before acceptance. HTMX remains useful for simple login or fatal operational pages, not the conversation client.

## Repository and fixture inputs

- Decision worktree base after the required in-progress commit: `12348cfa721cd0c14c87b8cc81db7be174a1f294`.
- Platform: Linux `7.0.0-31-generic` x86-64; Node `22.23.2`; npm `10.9.8`; Python `3.14.4`.
- Pi evidence: `issues/probe-pi-control/events.redacted.jsonl` at revision `4187da0ec40079ec09d98539c03f840102cde616`, SHA-256 `d7981abf9aff8896dd5dc950e13ceaf926b406c5001416ddbe1ddc620520702a`.
- The source is a real Pi 0.85.1 RPC/session probe with synthetic redacted prompts and content. The frontend trial transcribes its user, assistant, tool-start, tool-update, tool-end and diff shapes. It did not read Jari's personal histories.
- The long-history fixture repeats safe redacted output to 2,500 stable-key events. It is a rendering stress fixture, not a claim that repeated synthetic rows match every native history distribution.

## Primary sources

Primary documentation was retrieved on 2026-09-22. Package behavior was checked against the locked npm artifacts; repository HEADs below identify the inspected upstream source state without claiming that HEAD equals the package tarball.

| Subject | Primary source | Upstream HEAD inspected |
|---|---|---|
| React component/data model | <https://react.dev/learn/thinking-in-react> | `facebook/react@8b0da1c6e4c225ea674e96b7790c4b538542e71a` |
| Vite static/backend integration | <https://vite.dev/guide/backend-integration.html> | `vitejs/vite@1544bb1b7ac92f775e9d0dea97954c99cc6cbd43` |
| React Router route model | <https://reactrouter.com/start/declarative/routing> | `remix-run/react-router@17c8dcd405bcb086abcaf3076da0a96845acd2f6` |
| Redux state guidance | <https://redux.js.org/style-guide/> | `reduxjs/redux-toolkit@c9dac937d77adc3bf04842a43955e81d0e7a46da` |
| React Aria accessibility | <https://react-spectrum.adobe.com/react-aria/accessibility.html> | `adobe/react-spectrum@8ae29fa17598c840955c6ed0e91b3524d8f13e5a` |
| Markdown safety and component mapping | <https://github.com/remarkjs/react-markdown/blob/a758d3c302151caced5b9f5a092fa61e16c118a5/readme.md> | `remarkjs/react-markdown@a758d3c302151caced5b9f5a092fa61e16c118a5` |
| HTML sanitation | <https://github.com/rehypejs/rehype-sanitize/blob/b3ee205aeda4e0fc276cb6664b2d6d339305fcd6/readme.md> | `rehypejs/rehype-sanitize@b3ee205aeda4e0fc276cb6664b2d6d339305fcd6` |
| Highlighting | <https://shiki.style/guide/install> | `shikijs/shiki@ac8e1c438626dbf6f6b4a7fda62276a24c479baf` |
| Virtualization | <https://tanstack.com/virtual/latest/docs/framework/react/react-virtual> | `TanStack/virtual@78371e851e90fd74e984deeb0c3fd8098e2cd4f3` |
| Component catalog | <https://storybook.js.org/docs> | `storybookjs/storybook@c2cb5d6269b634f68fd77037f48c436e7bfb3953` |
| Browser testing | <https://playwright.dev/docs/test-accessibility> | `microsoft/playwright@3bbcbca70216df6c082688b1eb03cc6dfecabcd7` |
| SvelteKit SPA trade-offs | <https://svelte.dev/docs/kit/single-page-apps> | `sveltejs/kit@8c9abce6982842a8706b49c1785f26946229c351` |
| HTMX SSE behavior | <https://htmx.org/extensions/sse/> | `bigskysoftware/htmx@203e6e806880372a848e50f08542f7779cd5d826` |

The upstream HEADs above identify source revisions; changing live documentation remains a limit. Exact package tarball integrity values are retained in `experiment/package-lock.json`.

## Tested direct packages and licenses

The disposable `package-lock.json` records the entire transitive graph. These are the direct packages that define the recommendation or trial:

| Package | Version | License |
|---|---:|---|
| React / React DOM | 19.3.0 | MIT |
| TypeScript | 6.0.3 | Apache-2.0 |
| Vite / React plugin | 8.3.0 / 6.1.1 | MIT / MIT |
| React Router | 8.4.0 | MIT |
| Redux Toolkit / React Redux | 2.12.0 / 9.3.0 | MIT / MIT |
| React Aria Components | 1.21.1 | Apache-2.0 |
| TanStack React Virtual | 3.14.13 | MIT |
| React Markdown / Remark GFM / Rehype Sanitize | 10.1.0 / 4.0.1 / 6.0.0 | MIT / MIT / MIT |
| Shiki | 4.4.3 | MIT |
| parse-diff | 0.12.0 | MIT |
| Storybook / React-Vite / a11y addon | 10.6.0 / 10.6.0 / 10.6.0 | MIT / MIT / MIT |
| Vitest / jsdom | 5.0.1 / 30.1.1 | MIT / MIT |
| Testing Library React / User Event / jest-dom | 16.3.3 / 14.6.7 / 7.0.1 | MIT / MIT / MIT |
| Playwright / Playwright Test | 1.63.0 / 1.63.0 | Apache-2.0 / Apache-2.0 |
| Axe Core / Axe Playwright | 4.13.0 / 4.13.0 | MPL-2.0 / MPL-2.0 |
| ESLint / TypeScript ESLint / JSX a11y / React Hooks | 9.39.5 / 8.70.1 / 6.10.2 / 7.1.1 | MIT / MIT / MIT / MIT |

Versions were installed from the npm registry with a disposable cache at `/tmp/native-agent-host-frontend-npm-cache`. Playwright Chromium was installed under `/tmp/native-agent-host-playwright`. No persistent machine package or browser was installed.

## Disposable trial

The runnable files are in [`experiment/`](experiment/). They are decision evidence, not the beginning of `web/` and not a product scaffold.

The trial checked:

1. one Redux reducer boundary replacing a native snapshot while retaining the client command ledger, deduplicating replay, rejecting a cursor gap as stale, appending a streaming tool update and retaining an `uncertain` command result;
2. a URL-owned `server/workspace/agent` selection and server/identity/agent-keyed `sessionStorage` draft that survives reload, remains distinct across same-page agent route changes and clears by identity;
3. representative redacted Pi message and streaming tool events, plus 2,500 long-output timeline records with per-event tool disclosures (not production grouping);
4. virtual mounting of fewer than 50 rows, focus outside the timeline unaffected by a stream-triggered dispatch and a keyboard-focusable scroll region;
5. Markdown raw HTML and `javascript:` URL rejection, escaped parsed unified diff content and separately tested Shiki token generation without inserting highlighter HTML;
6. a Storybook story built from the same rich-content components; and
7. Chromium Axe analysis with zero violations in the exercised page.

Final successful commands from `issues/choose-frontend-stack/experiment/`:

```sh
npm ci --cache /tmp/native-agent-host-frontend-npm-cache --no-audit --no-fund
PLAYWRIGHT_BROWSERS_PATH=/tmp/native-agent-host-playwright npx playwright install chromium
npm run typecheck
npm run lint
npm test
npm run build
PLAYWRIGHT_BROWSERS_PATH=/tmp/native-agent-host-playwright npm run test:e2e
npm run build-storybook
```

Results:

- TypeScript: pass.
- ESLint with zero warnings: pass.
- Vitest: 2 files, 5 tests passed.
- Vite production build: pass in 243 ms; `index` JavaScript 510.16 kB minified / 159.98 kB gzip, with a chunk-size warning. This app bundle excludes Shiki, which was exercised only in Vitest; production must measure its lazy worker/engine/language chunk separately.
- Playwright Chromium: 2 tests passed in 3.5 s; long-history mounting, reload and cross-agent drafts, external-control focus retention, route selection, unsafe markup and uncertain acknowledgement covered.
- Storybook static build: pass; its manager/a11y bundles also emitted chunk-size warnings.
- Clean `npm ci`: pass, with an npm deprecation warning that ESLint 9.39.5 is no longer supported. It was the newest major accepted by the tested JSX accessibility plugin; the install was not forced.

The bundle warning is evidence against shipping the eager shape. The number is not a full recommended-stack budget because Shiki was outside the application import graph. ADR 0002 requires lazy rich renderers/dialogs, a Shiki `core` worker with only the selected engine/languages/themes, and measured initial plus lazy-chunk budgets rather than suppressing the warning.

## Failures encountered and resolved

A stable redacted chronology is in `experiment/evidence-logs/trial-summary.log`.

- The first install failed because ESLint 10.11.0 exceeded `eslint-plugin-jsx-a11y` 6.10.2's declared peer range. It was not forced; the trial pinned ESLint and `@eslint/js` 9.39.5 and installed cleanly.
- A registry query for nonexistent `@types/parse-diff` returned 404. `parse-diff` includes declarations, so the nonexistent package was removed.
- One command batch accidentally ran at repository root and found no `package.json`. It made no product changes; the same commands were rerun in `experiment/`.
- Initial typecheck/lint/unit/e2e attempts found trial defects: missing CSS declaration, an invalid diff union property, Vite/Vitest config typing, typed-lint scope, Vitest globals/e2e exclusion, an incorrect raw-HTML expectation, absent disposable Chromium, a heading-level error and a brittle script-count assertion. Each was corrected and the complete final sequence passed.
- Storybook and Vite reported large eager chunks. This remains a measured limitation, not a failed check; production code splitting is an explicit acceptance proof.

No external review or panel failure is hidden here. A broad panel was not used because the primary evidence, deterministic trial and option matrix resolved the trade-off; a focused evidence-gated review is recorded below.

## Limits and next proofs

- The fixture uses real Pi protocol shapes but synthetic redacted content. It does not measure a personal history or all unknown tool payloads.
- Two thousand five hundred mostly repeated rows demonstrate DOM bounding and basic interaction, not production memory, variable-height anchor correctness or screen-reader usability.
- Axe finds a subset of accessibility defects. Dialog return focus, live-region cadence, collections, IME, Finnish keyboard behavior and assistive-technology reading order need hands-on tests.
- The experiment has no network server, real SSE loss/replay, host snapshot validation, CSP headers, authentication, two-user separation or Pi one-off title call.
- It does not establish output retention/truncation contracts or backend deployment commands.
- React Aria wrappers, reducer schemas, route fallback, lazy chunk boundaries and performance budgets remain implementation work after human acceptance.
- ESLint 9.39.5 is a tested compatibility pin but already unsupported upstream. At the acceptance/scaffold gate, recheck for an ESLint 10-compatible JSX accessibility plugin or a maintained equivalent; do not force an invalid peer graph.

## Repository validation and DAG confirmation

After removing generated `node_modules`, build, Storybook and Playwright output, the exact required checks were run from the repository root:

```sh
python3 scripts/validate-project-view.py
issuectl doctor --json
git diff --check
issuectl dag --json --reservations '[]'
```

The project view reported 13 pages and 13 navigation entries. Doctor reported no cycles, broken references, schema violations, transition warnings, deferred labels or untriaged drafts. `git diff --check` was clean. The DAG reported no missing blockers; every lane member was `open` or `in-progress`, never `deferred` or `untriaged`. The three `human-review` items (`review-ui-v1`, `review-implementation-plan`, `review-mvp`) have no lane; their issue records confirm the label and reviewer. `build-app-foundation` remains blocked by the open `review-implementation-plan`, which itself remains blocked by `plan-v1-implementation`, so this proposal cannot activate implementation.

## Review level

A single focused evidence-gated final review was selected. The decision had no unresolved cross-lens tie after the trial: React's downside (bundle/dependency weight) is measurable and can be gated, while the accepted interaction model clearly rejects minimal-state HTML. A broad panel would add opinion rather than resolve missing evidence.

`claude-fable-5-1` found seven concrete evidence/consistency candidates. Local inspection confirmed all seven, and the conditional verifier `gpt-6-astra` independently tried to refute each; all survived, with qualifications that command loss depended on the snapshot payload and that the Playwright path was recorded but the install command was not. The artifacts were corrected before closure: snapshot replacement now retains command state and rejects gaps, agent route changes isolate drafts, Shiki is excluded explicitly from the app bundle figure, clean-checkout/browser commands and the Node range are stated, and focus/tool-grouping claims are narrowed to what was tested. No unresolved review finding remains.
