# Production UI design result

## Outcome

The accepted workspace and conversation designs now have one production v1
design specification, one bounded component-catalog contract and one static
correction artifact. This delivery contains no application/runtime implementation,
does not accept Proposed ADR 0002 or 0003, does not change machine schemas and
does not modify the received HTML/JSX deliveries.

## Exact inputs and revisions

Work started from repository revision
`cbf151b28925b94a1b61681a4d1d511bcab445b9`, the required separate
in-progress metadata commit. Inputs were inspected at these source revisions:

| Input | Revision |
|---|---|
| `issues/plan-v1-implementation/plan.md` | `a41065f5984621e4c7c76050960b4e1ed3841086` |
| accepted `issues/review-ui-v1/review.md` and `docs/product.md`/`docs/ui.md` | `9732ffbd3ff0af37911b84b86f321808e482c13b` |
| `issues/receive-designer-v1/review.md` | `c2c0be8ba0c62f56144ffaa8132cbc92d27e3332` |
| received sources under `design-system/drafts/v1/` | repository state at starting revision; files left byte-unchanged |
| `issues/probe-pi-control/result.md` | `4187da0ec40079ec09d98539c03f840102cde616` |
| `issues/probe-workspace-lifecycle/result.md` | `c1e06b0af9a2835106b5f27277dd1de31766856a` |
| accepted ADR 0001 | `642bd26c7f68009c8c59f284aca04f169ed97598` |
| Proposed ADR 0002 | `ffdf0e6eeb46aa44055b52569775d20956db1a01` |
| Proposed ADR 0003 | `958f974f1c9f1ac47af48b69a738bed7bfb1128b` |
| `docs/interfaces.md` and all `contracts/v1/` schemas/examples/scenarios | `311a354a3aaf222c3d9261468d379f8c0788599b` |
| prior `docs/design-system.md` | `0b0a16419e280aff57f08ce6a747fcb03584488c` |
| prior shared design-system guidance/tokens | `642bd26c7f68009c8c59f284aca04f169ed97598` |

Also read root/local AGENTS instructions, `AGENTS-WORKFLOW.md`, `docs/AGENTS.md`,
`contracts/AGENTS.md`, all v1 schema/example families, both designer handoffs and
the B/A visual source deliveries. The received files remain references rather
than backend evidence.

## Changes

### Canonical production design

- Added [`design-system/production-v1.md`](../../design-system/production-v1.md):
  reconciled source deviations; both light/dark themes; visual foundation;
  integrated app shell; routes/deep links; identity-scoped return routes;
  drafts and reload-safe uncertain receipts; reading anchors; virtualized and
  accessible paged history; selection/copy; streaming cadence; keyboard/focus;
  composer, Pi queue and questions; TUI transfer; connection/auth/read-only;
  workspace/Git/GitHub/Taskfleet/archive/delete flows and partial operations.
- Added [`design-system/component-catalog-v1.md`](../../design-system/component-catalog-v1.md):
  the needed primitives and product components, product-term props/intents,
  composition boundaries, all relevant async/read-only/stale/unknown/partial
  states and the implementation catalog/story matrix. Visual components never
  own Pi/network/domain reconciliation.
- Added [`design-system/ui_kits/production-v1/`](../../design-system/ui_kits/production-v1/)
  with the AGENTS/CLAUDE convention and a static, no-mock correction artifact.
- Reconciled shared tokens by adding rail/scrim and overlay shadows and replacing
  the conversation delivery's 380–900 ms motion with 160–180 ms production
  transitions and a small vertical appearance. Reduced-motion behavior remains.
- Updated `design-system/AGENTS.md` to make the production artifacts canonical
  while retaining existing JSX/`.d.ts`/cards as provenance-bearing v0.1 references.

### Reader documentation and review package

- Replaced `docs/design-system.md` with direct canonical/catalog/example links,
  theme scope, ownership and reference status.
- Extended `docs/ui.md` with the integrated route→draft→conversation→operation
  behavior and corrected its pre-decision queue wording.
- Added [`review.md`](review.md) with exact source corrections, catalog scope,
  seven acceptance decisions, unresolved adapter/proof needs and recommended
  acceptance wording for `review-implementation-plan`.
- Checked every issue acceptance criterion in `item.md`.

### Contract relationship and review corrections

No `contracts/v1/` file changed. The design uses supported commands and preserves
unknown/unsupported states. Review found four real semantic gaps and returns them
to implementation review instead of changing schema for visual convenience:

1. terminal operation retention/query for operation deep links;
2. exact texts/group/order actually removed by `agent.queue.clear`;
3. GitHub-create confirmation challenge/value; and
4. supported-question `response:null` mapping to native cancellation.

Until those are defined, operation absence is not success, queue clear-with-
editor-restore and GitHub submit are visibly blocked, and question cancellation
is capability-gated. Title generation, GitHub credentials/write proof,
Taskfleet create/partial teardown, process observation and real virtualization/
screen-reader behavior remain explicit adapter/proof needs.

## Independent review

Review level was a routine evidence-gated `/llm-review` with high-risk conditional
verification because this spec covers duplicate commands, writer ownership and
destructive partial operations. `claude-fable-5-1` found concrete candidates;
each was checked against local schemas/docs. `gpt-6-astra` then attempted to
refute the ten highest-impact survivors, refuted one overstatement and confirmed
or narrowed the others. `/assess-findings` axes and dispositions are preserved
in ignored `history/assessment-design-production-ui.{json,md}`; the full review
is `history/review-design-production-ui.md`.

All confirmed findings were corrected or converted to explicit blocked contract
needs. Corrections include reload-safe uncertain receipts, operation-outcome-
unavailable behavior, question cancellation states, browser-safe shortcuts,
unarchive focus, stable focused rail order, writer-lock example, title fixture,
selected/attention semantics, send-mode ownership, queue-clear race handling,
consistent dialog dismissal, identity-scoped auth return, host read-only state,
GitHub confirmation blocking and distinct skipped/unknown markers.

## Validation

Run from repository root on 2026-09-22 after the final corrections:

```sh
python3 scripts/validate-project-view.py
# exit 0: Project View valid: 14 pages, 14 navigation entries.

issuectl doctor --json
# exit 0; valid (recorded in final command output)

git diff --check
# exit 0; no output

python3 issues/define-host-contracts/validate_contracts.py
# exit 0: Host contracts valid: 10 schemas, 11 fixture files, 29 scenarios,
# 4 negative checks.

issuectl dag --json --reservations '[]'
# exit 0; recorded in final command output
```

The final DAG inspection found no missing blockers/cycles, no deferred or
untriaged lane member, and no executable lane on a human review. The
implementation path remains blocked by `review-implementation-plan`; Proposed
ADRs and this design are not silently accepted by documentation completion.

## Limits and tool/sub-workflow inventory

- No production app, Storybook, React component or backend exists yet, so static
  examples are design assets rather than browser integration tests.
- Exact frontend/host stack, retention budgets, model/cost trigger, credential
  flow and Alder pilot remain for `review-implementation-plan`.
- The optional `/assess-models` corpus append failed after the complete review:
  the installed helper's bounded SSH write to `alder` returned permission denied
  (exit 3). [`review-tool-failures.log`](review-tool-failures.log) preserves the
  stable redacted failure, impact and safe retry. This does not affect the
  repository review, assessment or corrections; only the external performance
  corpus entry is absent.
- No other required or optional tool/sub-workflow failed or remained incomplete.
