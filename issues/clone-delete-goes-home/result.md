# Result

Successful explicit removal of an interrupted clone now returns home via `/` (canonical `/workspaces` with multiple workspaces, `/` with one), replacing the workspace-creation page in history. A partial/uncertain removal stays on the page with its error; it does not imply successful cleanup. The removal remains a deliberate action on the clone page. Nothing is newly removed in the background or on other pages.

## Decisions for later review

- Return home after a successful removal even if other interrupted clones remain. They remain reachable from the rail's clone link. Replacing the clone page avoids Back immediately reopening the removal view.

## Verification

The interrupted-clone journey now asserts the home URL and heading after removal, reopens the remaining clone from the rail and proves its explicit restart still works. The conductor's earlier live disk check remains the evidence that the reported northwind clone left no directory; this run makes no live changes.

- `scripts/test-focused.sh --area browser --spec clone-page.spec.ts`: **7 passed**, including axe; one pre-existing capture-only test skipped by default. The separate evidence capture below ran.
- Fast web checks: format, lint, typecheck, **244 unit + 174 component tests passed**.
- `lab/after-removal-home-{wide,narrow,phone}-{light,dark}.avif` and adjacent static HTML: six synthetic lab views after removal, at 1920×1080, 1000×900 and 390×844. The canonical multi-workspace home is `/workspaces`, never `/workspaces/new`.
- Source tested/captured: `ff9fe451` plus the final canonical-home URL assertion and capture script in this result's commits. Browser runs use production assets and isolated synthetic gateway/daemon homes, not a live browser session.

## Failed attempts and review limits

Initial format checks needed formatting. An early overlapping Playwright invocation deleted another run's trace artifacts; both specs were rerun sequentially, with clean final passes. No required evidence remains missing. Focused self-review checked partial-removal handling, explicit-only destruction, remaining-clone access and canonical-home navigation. No host code, contracts, deployment, real provider or UID-isolation behavior changed or was newly verified.

## Reproducing the synthetic evidence

Browser commands ran under `umask 077`, a fresh short `/var/tmp/oh-XXXX` TMPDIR, `OH_PORT_BASE=14500`, `OH_BROWSER_WORKERS=2` and `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright`. Fast checks used `scripts/test-web-fast.sh`.

Capture: start `.cache/browser-host "$PWD/web/dist"` with `BROWSER_HOST_LAB=1 BROWSER_HOST_PORT=14901`, record 14901 in `.cache/lab/port`, then run `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node web/lab/capture-web-polish.mjs`. It captures all three issues against the fresh synthetic home. Each PNG was converted with `avifenc -j 2 -s 8 -q 82 <image.png> <image.avif>`; the PNG was then removed, retaining its adjacent self-contained HTML. The temporary lab host was stopped after capture. The six-view contact sheet was inspected locally, not published.

## Integration check

Rebased onto local main `8ae02c31`; the only conflict was additive live-check sections in `KOKEILTAVAA.md`. Both workers' sections were retained, with these three checks at the top. No implementation conflict. On rebased revision `b29f6143`, reran fast web checks and all three focused browser specs: all passed (13 browser cases, one pre-existing capture-only skip). Paired visual evidence remains from the pre-rebase source identified in its HTML headers. Project-view validation, issue doctor and diff whitespace checks passed after integration. No push or deployment.
