# Implementation planning result

> The package described below was the 2026-09-22 delivery. Jari's eight 2026-09-23 corrections supersede its Rust, TypeScript 6/ESLint, Google-primary, broad GitHub-proof and acceptance-workflow recommendations. The current review package is `review.md`; exact corrected evidence is in `issues/apply-review-corrections/result.md`. Historical command/evidence statements below remain as delivered, not current requirements.

## Outcome

Prepared a decision-ready v1 implementation package at revision `0dd5226ba18d410f22eade7fa4500310cf8e9924` (short `0dd5226`). It preserves the required walking core and all accepted M1–M7 work without implementing product code, accepting Proposed ADR 0002/0003 or deploying anything.

## Changes

- Added [`implementation-briefs.md`](implementation-briefs.md) with frozen source revisions, proposed repository layout, AI-first operator CLI, full foundation green gate, CG-01–CG-04 contract corrections, fixtures, 12 bounded downstream briefs, exact proposed commands, ownership/recovery/evidence and one owner/verifier for Y1–Y5/M1–M7.
- Added complete CT-001–CT-033 implementation-test ownership and [`validate_plan.py`](validate_plan.py).
- Added [`review.md`](review.md) with direct links, recommendations and exact decisions for ADRs, production design, contract limits/corrections, title adapter, Google OIDC, two-user GitHub proof and Fleetrepo/Alder operation.
- Clarified every downstream issue body. The serial `ui-v1` path already expresses the safe dependency order, collision arrays already cover shared `docs/`, `AGENTS.md` and `design-system/`, and `review-implementation-plan` remains an unlaned human gate. No blocker/lane/collision mutation was necessary.
- Updated `docs/implementation.md`, `docs/decisions.md` and `docs/interfaces.md` to distinguish proposal, acceptance, executable proof and deployment. `docs/status.md` records the delivered package separately.
- Recorded the optional review/tool failures in [`review-tool-failures.log`](review-tool-failures.log).

## Review and corrections

A critical evidence-gated review used `claude-fable-5-1`, local primary evidence, and independent `gpt-6-astra` verification. It corrected OIDC specificity, VM ownership, GitHub proof ordering, CT mapping, first-install/update/rollback safety, Fleetrepo convergence gating, confirmation bounds, host-sensitive commands, fleet-warning baseline, test tiers, OIDC pilot login and contract/Y2 ownership. The verifier found and triggered correction of two stale CT references. Ignored review and `/assess-findings` artifacts are under `history/`; no finding warrants a new issue.

The selected `openai-codex/gpt-5.6-luna` title model was checked with `pi --list-models luna` on Pi 0.85.1. Runtime title use remains capability-unknown until its real adapter test.

## Issue and DAG state

- `plan-v1-implementation` was moved to `in-progress` and committed separately before substantive work.
- All eight acceptance checkboxes were completed after the package and downstream boundaries existed.
- No new issue was filed. CG-01–CG-04 are bounded foundation corrections before generated consumers; creating a separate untriaged item would not improve the safe serial gate.
- `build-app-foundation` remains blocked by open `review-implementation-plan`, which remains blocked by this preparation issue until closure.
- All lane members are executable lifecycle states; there are no missing blockers or cycles. Human reviews have no lane.

## Validation

Run from repository root against the final planning tree:

```sh
python3 issues/plan-v1-implementation/validate_plan.py
# Implementation plan valid: 12 briefs, 12 criterion mappings, 33 contract scenarios, 4 contract corrections.

python3 scripts/validate-project-view.py
# Project View valid: 14 pages, 14 navigation entries.

issuectl doctor --json
# exit 0; no parse/schema/reference/dependency/status findings

git diff --check
# exit 0; no output

python3 issues/define-host-contracts/validate_contracts.py
# Host contracts valid: 10 schemas, 11 fixture files, 29 scenarios, 4 negative checks.

issuectl dag --json --reservations '[]'
# exit 0; no missing blockers/cycles, no deferred/untriaged lane members,
# human reviews unlaned, implementation blocked on review-implementation-plan
```

The machine contract remains 29 scenarios in this task. CT-030–CT-033 are precise proposed additions owned by `build-app-foundation`; they are not falsely counted as existing executable contract tests.

## Limits and authorization

No Rust/web scaffold, runtime, VM harness, OIDC client, GitHub remote, Fleetrepo declaration, account, package, service or deployment was created. Commands remain proposed until foundation/operations implements and proves them. ADRs 0002/0003 and production design remain unaccepted until Jari's review.

Alder deployment and the root route are authorized only after the review and executable gates. Persistent Alder state remains solely Fleetrepo-owned and requires its own reviewed issue/worktree and convergence evidence. `prepare-mvp-operations` cannot finish, and therefore the pilot cannot become runnable, until that separate Fleetrepo commit/check is recorded.

## Tool/sub-workflow inventory

All required commands and the critical review completed. Two optional steps failed safely:

1. A nested Rowan→Alder read-only context route exited 1. The shell was already on Alder; the same read ran locally and completed the review evidence.
2. `/assess-models` could not append to the external corpus because bounded SSH to `alder` was denied (exit 3 / SSH 255). The review, verifier and local assessment completed; only the external performance row is absent.

The stable redacted log and safe retry instructions are in `review-tool-failures.log`. No credentials or machine state were changed.
