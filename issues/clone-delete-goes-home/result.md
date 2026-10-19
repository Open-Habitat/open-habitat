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
