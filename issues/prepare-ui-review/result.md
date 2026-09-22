# UI review preparation result

## Outcome

The accepted full-MVP journeys, both design deliveries, Pi control evidence, and
workspace/GitHub/Taskfleet/archive evidence are now one decision-ready package.
The package is ready for Jari's `review-ui-v1` human gate; no design choice was
autonomously accepted and no product code was implemented.

Substantive delivery commit: `3a15df8ddc2b9e1c63c343811c4cb1c28c0da4ec`.
The worktree was based on the separately committed in-progress metadata revision
`2814d7ed4f1a18125a8ecc5185c2ec961065d04f`.

## Exact inputs

| Input | inspected revision |
|---|---|
| root `AGENTS.md`; implementation plan | `a41065f5984621e4c7c76050960b4e1ed3841086` |
| `AGENTS-WORKFLOW.md` | `891d4e50c096a1ab1e0d0d371f665f730b35fb31` |
| `docs/AGENTS.md` | `0b0a16419e280aff57f08ce6a747fcb03584488c` |
| design-system guidance | `642bd26c7f68009c8c59f284aca04f169ed97598` |
| Pi control result | `4187da0ec40079ec09d98539c03f840102cde616` (delivered), with closure recorded at `71f0caafce46ecf46a743a68a4af5ee90b2009c3` |
| workspace lifecycle result | `c1e06b0af9a2835106b5f27277dd1de31766856a` |
| design reception, workspace handoff and accepted host direction | `c2c0be8ba0c62f56144ffaa8132cbc92d27e3332` |
| conversation design handoff and durable design organization | `642bd26c7f68009c8c59f284aca04f169ed97598` |
| prior product, UI, assumptions and architecture baseline | `3d160ddd9e7b2b94468fa9d4112e544b7fc12fbf` |
| this issue's in-progress metadata | `2814d7ed4f1a18125a8ecc5185c2ec961065d04f` |

The visual inventory included the conversation main flow, B1–B10/B12 states,
B5a–B5f tool states, visual specification, host A1–A9 main mock and A1–A9
summary under `issues/receive-designer-v1/design/`. All were treated as design
references with simulated behavior, never as backend evidence.

## Changed artifacts

- `docs/assumptions.md` now records both probes' inspected versions, observed
  evidence, limitations, proposals, unknowns and design consequences. A6 remains
  structurally open for two-user GitHub writes; A14 remains open for daemon
  ownership and reconnect.
- `docs/product.md` now states one login-to-conversation flow, the complete M1–M7
  host scope, positive process-exit evidence for resume, owner-mediated terminal
  transfer, and Taskfleet-first linked-worktree teardown.
- `docs/ui.md` now ties the two designs to both probes, preserves the complete
  state inventory, and recommends exact answers for queue/steering, synopsis,
  drafts/focus, scroll position, attention, controllability, uncertain send, and
  partial host operations.
- `review.md` is the concise human package: direct visual/evidence links,
  accepted prior direction, eight exact decisions with recommendations, an
  artifact-labelled walkthrough, and explicit wording Jari may accept or amend.
- `review-tool-failures.log` records the one optional review-corpus logging
  failure and its safe retry. No required tool or sub-workflow failed.

No technically necessary feature deviation was found. Probe evidence narrows
behavior instead: unknown process observation blocks resume; a terminal TUI is
read-only until its owner/user stops it; Pi supports whole-queue clear rather
than per-item cancellation; and destructive/GitHub operations expose ordered
partial outcomes. GitHub, Taskfleet worktrees, archive, workspace lifecycle,
two-user separation, reconnect, uncertain-send, pending, failed, disabled and
read-only behavior all remain explicit.

## Independent review

A critical evidence-gated `/llm-review` was selected because this broad product
synthesis defines authentication, concurrent Pi-writer safety, and destructive
workspace behavior. `claude-fable-5-1` found concrete candidates; each was
checked against primary probe/RPC evidence. A fresh `gpt-6-astra` verifier tried
to refute the batch. Local `/assess-findings` classification confirmed and
corrected the surviving gaps, including unknown-process resume, linked-worktree
deletion, unsupported per-item queue cancellation, draft identity clearing,
terminal stop ownership, open A6, stale demo wording, mock/evidence labelling,
and acceptance coverage. No finding remains unresolved and no follow-up issue
was needed.

The optional `/assess-models` corpus append failed with SSH permission denied to
Alder (exit 3). The stable redacted log is
[`review-tool-failures.log`](review-tool-failures.log). This did not affect the
review, local assessment, corrections, or deterministic checks.

## Verification

Run from repository root on the final content:

```sh
python3 scripts/validate-project-view.py
# exit 0: Project View valid: 12 pages, 12 navigation entries.

issuectl doctor --json
# exit 0: no cycles, broken references/blockers, schema/status violations,
# conflict markers, or warnings.

git diff --check
# exit 0; no output.

issuectl dag --json --reservations '[]'
# exit 0. No missing blockers; no deferred/untriaged lane member; human-review
# issues have no lane; review-ui-v1 remains blocked only by this task before
# closure; build-app-foundation remains blocked by review-implementation-plan.
```

The DAG has no blocker cycles (`issuectl doctor`), `review-ui-v1`,
`review-implementation-plan`, and `review-mvp` remain unlaned human gates, and
the implementation lane cannot execute before its required reviews deliver.

## Remaining limits and handoff

This is a reviewed specification, not a running product. GitHub write operations,
the second user's credential path, browser credential UX, daemon/SSE recovery,
command-ID retention, process-observation completeness, symlink/mount races,
crash recovery, and real partial Taskfleet teardown still require their recorded
contract and implementation tests. No deploy or Glasspad publication applies to
this task.

Next action: present [`review.md`](review.md) to Jari under `review-ui-v1` and
record his actual answers, date, reviewed revision and limits there. Keep that
human-review issue open until explicit acceptance and any requested corrections
are complete.
