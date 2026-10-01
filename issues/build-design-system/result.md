# Production design system result

## Revisions and scope

- Accepted production design/catalog input: `62c0ae6833301bcdd0901053ea08ef514a929153`.
- Accepted application foundation product input: `079694adf0f9cdabddf6cc7289672d1d813a521f`.
- Accepted implementation-readiness artifact: `b87b1aae5d6fefcd914d4f06c0e510b5ca124f60`.
- Tested product revision: `9fc0840` (implementation commits `c3cd5cb`, `f387657`, and documentation correction `9fc0840`).
- Runtime/toolchain: React 19.3.0, React Aria Components 1.21.1, Storybook 10.6.0, Playwright 1.63.0, Axe 4.13.0, Chromium 153.0.8010.12, Node 22.23.2, Go 1.27.1.

This slice replaced the superseded canonical mock component tree and static production kit with typed production modules under `web/src/components/`. The original received design is now preserved under `design-system/drafts/v1/`. Both the app and Storybook import the production modules. The deterministic browser preview is guarded by `VITE_ENABLE_TEST_FIXTURES=true`, lazily imported from `web/src/test/`, and absent from the production bundle.

## Component ownership

- `Primitives.tsx`: Button, TextField, TextArea, SearchField, Checkbox, RadioGroup, Select and visible control reasons.
- `Overlays.tsx`: React Aria Dialog, AlertDialog and Menu wrappers plus accessible Tabs and Disclosure.
- `Status.tsx`: textual StatusMark/Badge, progress, persistent notices, additive connection/read-only state, toast and stream announcer.
- `Navigation.tsx`: AppShell, real links, WorkspaceRail/Section, AgentNavItem, AgentHeader and AgentFacts.
- `Conversation.tsx`: timeline/messages, safe display boundaries, code/diff, tools, questions, composer/queue and command receipts.
- `Operations.tsx`: capability notices, Finnish non-colour operation stages and form error summary.
- `components.css`: token-based light/dark styling, 2 px focus-visible treatment, long-content wrapping, responsive 200% layout and reduced-motion behavior.

These modules receive display models and emit intents. They contain no HTTP/SSE calls, command-ID construction, retries, native capability discovery, snapshot/event reconciliation or draft persistence. Those remain application-layer responsibilities.

## Deterministic verification

The focused package gates passed at revision `9fc0840`:

```sh
npm run format:check --prefix web
npm run lint --prefix web
npm run typecheck --prefix web
npm run test:unit --prefix web            # 1 test
npm run test:component --prefix web       # 15 tests
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:e2e --prefix web   # 9 tests
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:a11y --prefix web  # 2 tests; four design theme/state combinations plus foundation states
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:visual --prefix web # 6 tests
npm run build --prefix web
npm run storybook:test --prefix web       # executable static Storybook build
npm run build-storybook --prefix web
```

Assertions cover visible disabled/read-only reasons, IME handling, pending-send duplicate prevention, initial/return focus, blocked Escape, menu and tab keyboard navigation, status text independent of colour, diff metadata, collapsed errors, Finnish operation state labels, additive stale/read-only state, both themes, 1280 px desktop at an effective 200% zoom, reduced motion and Axe. The production Vite build also proved the hostile test fixture absent.

The required clean foundation gate passed in full:

```sh
mkdir -p "$PWD/.cache/ci-tmp"
export TMPDIR="$PWD/.cache/ci-tmp" PATH="$PWD/.tools/go/bin:$PATH"
./scripts/ci-local.sh --clean --json
# {"schema_version":1,"data":{"status":"passed","clean":true},"warnings":[]}
```

That run included all locked frontend, Go race/build, generated-contract drift, contract/plan/project validators, license policy, native/VM self-test, reproducible package/relocation/tamper checks, issue doctor, diff check and clean-tree assertion. The required direct project checks were also run after the evidence update:

```sh
python3 scripts/validate-project-view.py
issuectl doctor --json

git diff --check
```

## Focused final review

One `/llm-review` workflow reviewed component ownership, app/Storybook identity, accessibility, focus, state completeness and deterministic evidence. Finder `claude-fable-5-1` produced source-specific candidates. Local verification and correction addressed fixture leakage, React Aria selectors, Escape handling, tabs, pending sends, Finnish state labels, read-only semantics, focus retention, diff headers, collapsed errors and overstated Storybook evidence. Verifier `gpt-6-astra` refuted eight corrected claims and narrowed two remaining defects (duplicate description IDs and collapsed ToolGroup error text); both were fixed with regression tests. The report is in ignored `history/review-design-system-final-diff.md`.

## Failed/incomplete tool inventory

All required steps ultimately passed. Bounded failures and remedies were:

- The first visual run found Chromium absent; the pinned browser was installed into `.cache/ms-playwright`, then all browser checks passed.
- Early focused tests exposed missing exact-text/focus timing and one Axe heading-order defect; assertions/components were corrected before the final runs.
- Clean CI attempt 1 lacked repository-local Go; `./scripts/bootstrap-tools.sh` provisioned the accepted local toolchain.
- Clean CI attempt 2 exhausted `/tmp` while linking race tests; rerunning with repository-local `TMPDIR=.cache/ci-tmp` passed the Go stage.
- Clean CI attempt 3 found the intentionally removed static catalog still linked from `docs/ui.md`; the link now points to the executable catalog and attempt 4 passed completely.
- The optional `/assess-models` corpus append failed because `ssh alder` rejected authentication. This did not affect either model response, local verification, source, or required gates; no review finding was omitted.
- Storybook reports its existing large addon/vendor chunk warning. It was neither hidden nor suppressed; the production app bundle is 321.57 kB minified / 103.65 kB gzip and emitted no size warning.

## Remaining limits and handoff

This is a production component/catalog slice, not a real workspace, history, Pi-control or operation journey. Storybook's `storybook:test` is a deterministic build check; interactive addon feedback is not represented as a CI assertion, while Playwright+Axe provide the executable accessibility gate against the same modules. Manual screen-reader behavior, OS/browser combinations beyond Linux Chromium, real variable-height history, sanitized Markdown/Shiki workers, host-backed paging, split-diff parsing and route-owned operation dialogs remain with their assigned journey slices.

The issue is intentionally left in `testing`. Jari's remaining checkpoint is visual acceptance of `visual-acceptance.md`; only the conductor records that decision and closes the issue.
