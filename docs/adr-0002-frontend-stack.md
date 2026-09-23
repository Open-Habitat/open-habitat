# ADR 0002: Use a React and TypeScript single-page client

**Status:** Proposed

**Date:** 2026-09-22

**Authors:** Pi, for review by Jari Mustonen

## Context

Native Agent Host's first UI is a Finnish, desktop-first application for one server and Pi. It reads an HTTP snapshot, posts commands and follows one cursor-based SSE stream. The UI must preserve the accepted Pi queue and steering behavior, uncertain command acknowledgements, reconnect and resnapshot, per-tab drafts, reading position, keyboard focus and in-app attention. It must also render long histories, streaming tool output, Markdown, code and Pi `edit` diffs safely. The browser is not an owner of Pi history or host facts.

The existing JSX and HTML are visual references only. This decision compares a React client, a Svelte/SvelteKit client and a server-oriented HTML/HTMX approach against the accepted interaction model. It does not select the host implementation or claim that a product runtime exists.

## Decision

Subject to `review-implementation-plan`, build the browser as a client-rendered React 19.3.0 single-page application in strict TypeScript 7.0.2. Use Vite 8.3.0 for development and static production builds and React Router 8.4.0 for route matching. TypeScript 7 is accepted only while the complete locked graph installs and every build, type, lint, test, Storybook, Playwright and Axe gate passes without forced peers, disabled checks or nightly packages; incompatibility returns to human review rather than silently pinning TypeScript 6. Do not use server-side rendering or React Server Components in v1. The host serves the immutable Vite output and an `index.html` fallback under the authenticated, same-origin gateway; JSON/HTTP and SSE remain the backend boundary from ADR 0001.

Use Redux Toolkit 2.12.0 and React Redux 9.3.0 for the synchronized application model. Do not add RTK Query, TanStack Query, a second event store or component-level copies of server entities. The SSE adapter and HTTP command adapter dispatch typed actions into the same store. Use TanStack React Virtual 3.14.13 for measured timeline virtualization. Load rich renderers and infrequently used host-operation dialogs as separate chunks rather than reproducing the disposable experiment's eager bundle.

Use the existing CSS custom properties through `design-system/styles.css` and locally scoped CSS Modules. Do not introduce Tailwind, CSS-in-JS or a themed visual component suite. Build production components around React Aria Components 1.21.1 behavior and semantics. Storybook 10.6.0 with its accessibility addon is the component catalog.

The reviewed versions are pins for the first scaffold, not a promise to follow every major release automatically. The lockfile is committed. Dependency updates require the same typecheck, unit, component accessibility and browser checks as application changes.

## State ownership

Every persistent or synchronized fact has one owner:

| Concern | Owner | Rule |
|---|---|---|
| Native snapshot, cursor, normalized workspaces, agents, timeline events, queue and host-operation stages | Redux store | A snapshot replaces one generation atomically. SSE actions apply in cursor order and deduplicate stable event keys. A gap or expired cursor marks writes unavailable and triggers a new snapshot; the client does not invent intermediate state. |
| Command acknowledgement | The same Redux store, keyed by client command ID | The HTTP result and later snapshot/SSE evidence reconcile one ledger entry. `pending`, `accepted`, `rejected` and `uncertain` remain distinct. An uncertain command is never automatically resent. |
| Current server/workspace/agent selection | React Router URL | The route is the source of selection. Redux selectors resolve that identity against the current snapshot; there is no second `selectedAgent` field. Invalid or vanished selections produce an explicit state and deterministic fallback only after fresh evidence. |
| Per-tab draft | `sessionStorage`, through one draft repository | Key by server, web identity and native agent ID. A controlled editor may mirror the active value while mounted, but `sessionStorage` owns reload recovery. Successful acceptance clears it; logout or identity change clears that identity before showing new content. No Redux or server draft copy is added. |
| Ephemeral focus, open menu and measured row size | The owning component | These are not server facts. Expanded tool groups and the reading anchor use stable event keys so a replacement snapshot can restore them when the event still exists. Background events never move focus. |

One connection controller owns initial snapshot loading, the single `EventSource`, reconnect/backoff, cursor replay and resnapshot. It dispatches domain actions but does not expose a second observable state model. Reducers are pure; listener middleware owns bounded effects such as reconnect and draft clearing.

The timeline virtualizer uses native event keys, measures variable-height rows and anchors replacement snapshots to the first visible stable key. It auto-scrolls only when already at the bottom. Otherwise it leaves the reading position alone and exposes the accepted accessible new-content control. Screen-reader announcements are batched at meaningful boundaries rather than announcing token deltas.

## Rendering and security boundary

Treat every history item, model response, tool argument, tool result, filename and diff as untrusted text even though it came from a same-user process.

- Validate the host contract at the HTTP/SSE boundary and map known discriminated event types to components. Preserve an unknown type in an escaped generic view; do not dynamically select code or a component from an event string.
- Render Markdown with React Markdown 10.1.0, Remark GFM 4.0.1 and Rehype Sanitize 6.0.0. Do not enable `rehype-raw`. Keep an explicit allowlist for elements, attributes and URL schemes. External links get safe relationship attributes.
- Render ordinary tool output as text in semantic `pre`/`code` elements. Never insert tool-supplied HTML.
- Highlight code with Shiki 4.4.3 in a worker, using an explicit language/theme allowlist and token output rendered as React text nodes. Lazy-load it; preserve a usable plain-text fallback when highlighting is pending or fails.
- For a supported Pi `edit`, parse its supplied unified patch with `parse-diff` 0.12.0 and render escaped React nodes with line numbers and an accessible plain unified-diff view. Other writes remain generic tool output; the UI does not synthesize diffs.
- Render only a bounded visible window. Large code, diff and tool bodies start collapsed or progressively rendered, but remain available without rewriting native history. Exact transport/output limits belong to the host contract.
- Ship a restrictive same-origin Content Security Policy from the host, no inline application scripts, no third-party runtime assets, and no browser credentials in rendered content or client logs.

The disposable trial confirmed that raw HTML and `javascript:` links stay inert, patch text is escaped, Shiki can return tokens without trusting generated markup, and a 2,500-event fixture mounts fewer than 50 event rows. This is design evidence, not a substitute for contract fuzzing or production performance measurement.

## Component and catalog boundary

`design-system/` remains the visual source. During product implementation, create production components under the frontend source tree and make both the application and Storybook import those exact modules. Story files contain states and fixtures, never alternate component implementations. Wrap React Aria at the production component boundary so feature code uses product names such as `Button`, `Dialog`, `Menu`, `Tabs`, `TextField` and `ToastRegion`; do not leak library-specific props throughout journeys.

Use native HTML when it already supplies the right behavior. Use React Aria for composite controls, overlays, collections and focus management. The initial catalog contains only components needed by accepted journeys, including timeline rows, grouped tools, code, diff, supported user requests, composer, connection state, staged operations and accessible attention. React Aria is a behavior foundation, not a visual theme; the accepted tokens and Finnish content remain ours.

## Proposed commands

`build-app-foundation` should create one locked frontend package at `web/`, pin the tested Node `22.23.2` in `web/.node-version`, and declare `engines.node` as `>=22.23 <23` (the direct toolchain does not support every Node major). CI must use that pin. Then record these exact commands as verified only after they run there:

```sh
npm ci --prefix web
npm run dev --prefix web -- --host 127.0.0.1
npm run build --prefix web
npm run typecheck --prefix web
npm run lint --prefix web
npm run typecheck --prefix web  # tsc --noEmit
npm run test --prefix web
npm run test:e2e --prefix web
npm run storybook --prefix web -- --no-open
npm run build-storybook --prefix web
```

`test` means Vitest 5.0.1 plus React Testing Library 16.3.3 and User Event 14.6.7. `test:e2e` means Playwright 1.63.0 in Chromium, initially covering keyboard/focus, reconnection, drafts, reading anchors, uncertain sends, streaming/grouped tools, long output and route restoration. Run Axe 4.13.0 through `@axe-core/playwright` in critical journeys and Storybook's accessibility addon in catalog checks.

Use Biome 2.5.14 as the only formatter and primary linter, with its recommended rules plus explicit errors for React Hook placement/dependencies and interactive JSX accessibility (`useHookAtTopLevel`, `useExhaustiveDependencies`, the recommended a11y group, `noNoninteractiveElementInteractions`, and `useKeyWithClickEvents`). Keep `tsc --noEmit` as the type checker; Biome is not a type checker. The disposable locked TS7 graph proved that these rules reject a click-only noninteractive element and that the complete Vite/React/Storybook/Vitest/Playwright/Axe graph passes. If implementation discovers a required Hooks or JSX accessibility rule that Biome cannot provide, add one focused TS7-compatible lint tool with primary compatibility evidence, or block and return to review; do not weaken or disable the gate. Preserve the historical result that `typescript-eslint` 8.70.1 declares TypeScript `<6.1.0`; do not retry or force that rejected TS7 graph. Automated lint and Axe supplement, not replace, keyboard and screen-reader testing.

CI installs the pinned Playwright browser separately using Playwright's documented cache. Production deployment needs only the static `web/dist/` output; Node and npm are build-time dependencies, not Alder services.

## Deployment fit

A static client keeps the future per-user daemon and gateway independent of a JavaScript server runtime. It can be built in CI or the declared build environment, copied as versioned assets, served by the selected host, and rolled back with the host release. Same-origin serving simplifies authenticated requests, SSE and CSP. Client-side routing requires the host to return `index.html` only for known UI routes, never for API or SSE paths.

The initial eager application experiment emitted 510.16 kB minified JavaScript (159.98 kB gzip) and crossed Vite's 500 kB warning. That app import graph did not include Shiki; token generation was tested separately. Production must establish route/renderer chunking, build Shiki from `shiki/core` with only the selected JavaScript engine, languages and themes in a lazy worker, and measure both initial and lazy chunks before the working-core review. Alder's browser workload, memory on long histories and SSE behavior under realistic concurrent agents remain to be measured.

## Consequences

React's explicit state and mature accessible/rendering/testing ecosystem fit the event-heavy desktop UI and let the team translate visual JSX references without treating them as architecture. Redux gives snapshots, events and acknowledgements one replayable reducer boundary. A client-only build avoids a second rendering and data-loading mode.

The costs are more client code and a larger baseline than a small Svelte or HTML page. Redux actions and selectors require discipline. Virtualized variable-height, live content is difficult: focus, screen-reader order and anchor restoration need browser and assistive-technology tests. React Aria and Shiki are substantial dependencies, so wrappers, lazy loading, pinned versions and update checks are part of the decision.

## Assumptions requiring later proof

Before accepting this ADR or calling the frontend foundation complete, verify:

1. the final host contract can drive the reducer without parallel cached entities, especially resnapshot, cursor expiry and command-ID retention;
2. production React Aria wrappers match the accepted design and Finnish keyboard behavior, including dialogs, menus, collections, toasts and reduced motion;
3. representative long native histories and tool bodies stay within agreed startup, scroll, memory and chunk budgets on the pilot desktop;
4. variable-height virtualization preserves a stable reading anchor through stream updates and replacement snapshots and remains understandable with the chosen screen reader;
5. the sanitized Markdown, URL policy, code worker and diff parser withstand malformed and adversarial fixtures under the deployed CSP;
6. the gateway/daemon host can serve versioned static assets, UI-route fallback, cache headers and SSE correctly on Alder; and
7. the later verified Pi one-off-call adapter can update the replaceable conversation title without putting model calls or title authority in the browser; and
8. every user-visible slice supplies deterministic happy and relevant unhappy-path browser tests plus a Markdown visual-acceptance report with essential screenshots, exact revision, environment, scenarios and commands, followed by Jari's explicit issuectl-recorded acceptance before a dependent product slice treats that UI behavior as delivered.

A failed proof returns the affected choice to `review-implementation-plan`; it must not be hidden by narrowing the accepted UI.

## Rejected alternatives

### Svelte/SvelteKit with TypeScript

Svelte offers a smaller runtime and concise reactivity, and a Svelte client could satisfy the interaction model. SvelteKit also supports SPA fallback. It was not selected because this product does not need SSR or server data loading, while disabling those features retains framework conventions without a benefit. More importantly, the evaluated whole has a less direct equivalent to the chosen combination of React Aria's broad accessible primitives, the existing React renderers, Storybook integration and Redux's explicit event reconciliation. Choosing Svelte only for bundle size would trade away stronger evidence in the highest-risk areas. It remains a credible choice if the accessibility/component trial fails before acceptance.

### Server-rendered HTML with HTMX and minimal JavaScript

Server HTML is attractive for forms and host-operation pages, and HTMX has an SSE extension. It is rejected for the primary client because the accepted conversation is not minimal-state hypermedia: it must reconcile snapshots and cursors, preserve unsent per-tab drafts and focus, maintain a stable reading anchor while streaming, virtualize long histories, group mutable tool events, distinguish uncertain commands and update hidden-agent attention. Implementing those features around DOM swaps would create a substantial custom JavaScript application with split ownership between server fragments, HTMX and local code. Reacting to every token with server-rendered fragments would also increase traffic and make reconnect/deduplication harder. HTML endpoints may still serve login or operational error pages outside the authenticated application.

### SSR, React Server Components and multiple server-state caches

They add another render/data path without helping an authenticated live workspace. They also make ownership across snapshot, SSE and hydration harder to explain. The v1 client therefore has one client render mode and one Redux synchronized model. Revisit only with measured startup, indexing or public-content needs.

## Evidence

The comparison, primary-source revisions, exact package artifacts, failures, commands and limits are preserved in [`../issues/choose-frontend-stack/result.md`](../issues/choose-frontend-stack/result.md). The runnable disposable experiment is under [`../issues/choose-frontend-stack/experiment/`](../issues/choose-frontend-stack/experiment/).
