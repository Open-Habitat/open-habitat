# Result — state-aware shared UI controls

The migrated controls use React Aria behavior and a CSS Modules state recipe. [`ControlElements.tsx`](../../web/src/components/ControlElements.tsx) supplies buttons, icon buttons, router-aware links, menu items and disclosure buttons. [`Primitives.tsx`](../../web/src/components/Primitives.tsx) uses the same recipe for buttons and fields. Dialog and menu triggers/close buttons keep React Aria's keyboard, slot and focus behavior. Agent, workspace and home links, Päivitä, the account trigger and menu, return-list links, composer buttons and tool disclosures use this foundation. The view stylesheet no longer styles `.ah-button` or the migrated links from ancestors; the file-wide descending-specificity suppression is gone. Scoped suppressions remain for unrelated legacy layout ordering.

[`ControlStates.stories.tsx`](../../web/src/components/ControlStates.stories.tsx) contains production controls in both themes. Hover, press and focus are exercised on those controls, not represented by mock CSS classes. The browser regression check asserts meaningful computed background changes for hover and press, a 2 px keyboard-focus outline, menu focus, disabled behavior, shared hover-token propagation across the rail and return view, and transparent composer styling. The source guard covers the migrated controls rather than pretending the rest of the UI has moved.

The provisional palette values and next-work inventory are in [`design-system/components.md`](../../design-system/components.md) and the story. [@design-control-states](../design-control-states/item.md) decides the finished appearance. [@migrate-bespoke-controls](../migrate-bespoke-controls/item.md) still owns other bespoke controls (workspace toggle, Tiedot, mobile navigation, tool-row opener, queue links, read-only footer) and shared row/action layouts, including composer and jump-to-latest layout. [@refine-agent-status](../refine-agent-status/item.md) owns agent-state meaning. No library, authority or contract boundary changed.

## Visual evidence

All evidence is from the synthetic lab, not a live host or personal session. Every PNG has an adjacent inert offline HTML snapshot. Reduced motion was used to avoid capturing palette transitions mid-frame.

| Surface | Light desktop | Dark desktop | Light phone | Dark phone |
|---|---|---|---|---|
| Return view and rail | [PNG](return-light-1440.png) · [HTML](return-light-1440.html) | [PNG](return-dark-1440.png) · [HTML](return-dark-1440.html) | [PNG](return-light-390.png) · [HTML](return-light-390.html) | [PNG](return-dark-390.png) · [HTML](return-dark-390.html) |
| Open phone rail | — | — | [PNG](sidebar-light-390.png) · [HTML](sidebar-light-390.html) | [PNG](sidebar-dark-390.png) · [HTML](sidebar-dark-390.html) |
| Account menu | [PNG](menu-light-1440.png) · [HTML](menu-light-1440.html) | [PNG](menu-dark-1440.png) · [HTML](menu-dark-1440.html) | [PNG](menu-light-390.png) · [HTML](menu-light-390.html) | [PNG](menu-dark-390.png) · [HTML](menu-dark-390.html) |
| Read-only conversation and tool disclosure | [PNG](conversation-light-1440.png) · [HTML](conversation-light-1440.html) | [PNG](conversation-dark-1440.png) · [HTML](conversation-dark-1440.html) | [PNG](conversation-light-390.png) · [HTML](conversation-light-390.html) | [PNG](conversation-dark-390.png) · [HTML](conversation-dark-390.html) |
| New conversation and composer | [PNG](composer-light-1440.png) · [HTML](composer-light-1440.html) | [PNG](composer-dark-1440.png) · [HTML](composer-dark-1440.html) | [PNG](composer-light-390.png) · [HTML](composer-light-390.html) | [PNG](composer-dark-390.png) · [HTML](composer-dark-390.html) |

**Jari has not reviewed the appearance.** The state colors are provisional, not a designer-approved matrix.

## Verification

Runtime tree `80aba01` (implementation in `60d06b6`, `dfbb4da`, `80aba01`):

- `NAH_PORT_BASE=14000 ./scripts/test-web-fast.sh` passed: 72 unit and 73 component tests.
- `NAH_PORT_BASE=14000 PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/Sources/native-agent-host/.cache/ms-playwright npm run test:browser --prefix web -- --grep control-states` passed: two synthetic host-backed cases.
- `NAH_PORT_BASE=14000 ./scripts/ci-local.sh --clean --json` passed on the clean committed candidate: 122 default browser cases, 13 lab browser cases, Go/contract checks, Storybook build, packaging, project validators and issue doctor. Gate result: `{"status":"passed","clean":true}`. The command used disk-backed TMPDIR under `/var/tmp`; the script also sets its own `/var/tmp` scratch. The phone drawer/menu evidence and this report were added afterwards; runnable code and packaged inputs were unchanged, so the full gate was **not rerun** for those evidence-only additions.
- `python3 scripts/validate-project-view.py`, `git diff --check` and `issuectl doctor --json` pass after the documentation/issue edits. Doctor reports pre-existing PNG evidence advisories, but no schema violation, broken reference or large binary.

These runs do not prove distinct-UID isolation, real Pi/provider behavior, or live-server operation.

## Review

The final diff warranted independent review because this is a cross-view CSS cascade and control refactor. `claude-fable-5-1` proposed six concrete regressions; `gpt-6-astra` tried to refute them against code and synthetic DOM/CSS, confirmed the underlying defects, and narrowed overclaims about screenshot evidence and current account-name exposure. Two malformed selectors, disclosure/account layout, copy-button padding and the discarded workspace tooltip were corrected in `80aba01`. No review residual needs a new issue. This review supplemented, not replaced, the clean gate. An optional model-performance corpus write failed on the known alder self-SSH route; review output itself was complete.
