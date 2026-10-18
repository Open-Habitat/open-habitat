# Result

The tree now holds only what exists nowhere else; the rule is in root
`AGENTS.md`, "Code is the record". The previous tree is the tag `pre-prune`
(`baa2ceec`); the restructuring commit is `d28ce108`.

## What changed

- **Kept:** code; instructions (`AGENTS.md` files, `TESTING.md`,
  `AGENTS-WORKFLOW.md`, `CONFORMANCE.md`); `TODO.md` and `KOKEILTAVAA.md`;
  `docs/product.md`, `docs/operations.md`, `docs/index.md`, `docs/brand/`;
  `design-system/` except the component map; ADR 0007 (deferred), ADR 0024
  and 0025 (awaiting Jari's later review per `TODO.md`) and ADR 0026 (not yet
  implemented); open issues and the 58 closed issues they, `TODO.md` or
  `KOKEILTAVAA.md` still name.
- **To history:** `docs/architecture/` (7 pages), ADRs 0001–0023 except 0007,
  `design-system/components.md`, 47 finished prototype rounds (the example
  round and the integrations round stay), 11 one-off `web/lab/` capture
  scripts, and 321 closed issues (about 350 MB of evidence).
- **Rules the code cannot show** moved before removal: identity and
  authority, native truth and diagnostics rules into `internal/AGENTS.md`;
  stack and state ownership into `web/AGENTS.md`; message meaning and
  versioning into `contracts/AGENTS.md`; Storybook use into `TESTING.md`.
- **Repeatable:** `scripts/prune-closed.py` (lists, or with `--apply` removes,
  closed issues nothing living names, drops dangling `related`/`blocked_by`
  edges and one-off lab scripts); `scripts/from-history.sh <path>` prints a
  removed file; `validate-project-view.py` checks every local Markdown link in
  living documents; `AGENTS-WORKFLOW.md` makes the hand-off rewrite `TODO.md`
  and run the prune.
- **Gate:** the contract validator moved from `issues/define-host-contracts/`
  to `scripts/validate-contracts.py` (Go tests and both gate scripts follow);
  the v1 planning validator was dropped with its planning package.
- `TODO.md` went from 432 to about 110 lines. Its dated lessons were already
  in `AGENTS-WORKFLOW.md`, except the push hold during Jari's testing, the
  empty-file-argument hang and the conductor's own prototype commissioning,
  which moved there.

## Verified

- `issuectl doctor --json` exit 0 (after dropping 20 dangling edges in kept
  closed issues), `validate-project-view.py` valid, `git diff --check` clean.
- `./scripts/test-focused.sh --area contracts`: 47 schemas, 40 fixtures,
  34 scenarios valid. `go test -run 'Snapshot|Worktree|Contract|Schema'
  ./internal/daemon` passed with TMPDIR under `/var/tmp` (under the home
  directory the snapshot test rightly reports the home path as leaked).
- `scripts/from-history.sh` prints a removed ADR and lists a removed issue
  directory.
- `.claude/skills/design-package/scripts/test_assemble.py` now uses synthetic
  fixtures under `web/lab/fixtures/design-package/`; four of its six tests
  fail exactly as they did at `pre-prune`, on a credential false positive in
  `ProcessTray.tsx` (filed as `design-package-credential-false-positive`).
- Clean gate on `d28ce108` (`OH_PORT_BASE=14600 ./scripts/ci-local.sh
  --clean --json`): Go/contracts passed (242 s); the browser phase failed one
  case, `lab-worktree-agent.spec.ts:21` (archive answered 409), which then
  passed three times alone. Filed as `worktree-archive-409-under-load`.
- Two fresh `claude -p` sessions with read-only tools:
  - "Jatketaan TODO.md" (dry run) found the situation and the first action
    (Jari's test round from KOKEILTAVAA.md) without missing a removed
    document. It did find six stale or contradictory TODO/KOKEILTAVAA
    statements that predate this change (pushed main, a preserved OOM run
    already cancelled, two bugs "awaiting triage" already laned, series
    C/D/E that KOKEILTAVAA no longer has, "next release" items already in
    pilot.231, a dead Fleetrepo path in AGENTS-WORKFLOW.md); all corrected.
  - "Changing token and identity forwarding": found every applicable rule in
    `internal/AGENTS.md`, the code locations, and ADR 0004 through
    `scripts/from-history.sh`. It noted that no comment ties the token
    handoff code to an ADR, so finding the reason took an inference.

## Decisions for later review

- **ADR 0024 and 0025 stay** although implemented, because `TODO.md` lists
  them for Jari's later review; the next hand-off after that review removes
  them. ADR 0007 stays as a deferred decision.
- **The prune rule counts only open issues, `TODO.md` and `KOKEILTAVAA.md`
  as living referrers.** Instructions and kept documents must state what they
  need themselves; references from code comments are history pointers.
  Alternative: also count instructions, which would have kept evidence
  ledgers such as the guest proof record alive indefinitely.
- **The guest proof ledger** (`issues/prove-jit-guest-isolation/`) went to
  history; a change to a scenario now states its claim and limits in the
  result of the issue that changes it. It had not changed since 2026-10-06.
- **`docs/product.md`** lost its links to issues and two stale status claims
  (worktree agents "not yet implemented", workspace deletion "not in use"),
  rewritten as goals. It still mixes goal with implementation status in other
  places and would benefit from Jari's read.
- **One-off lab scripts** are recognised by writing only into issue
  directories that are gone, and removed by `prune-closed.py`.
