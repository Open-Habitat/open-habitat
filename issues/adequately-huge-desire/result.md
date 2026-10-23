# Result

## Root cause and fix

Product rendering regression in `web/src/app/HistoryView.tsx`, introduced by
`61f85228` (skill invocation panels), not a history pagination failure.
`Entry` supplied two conditional children to `UserMessage`. For a plain user
entry without a skill or typed blocks those children were `[null, undefined]`,
a non-null React children array. `UserMessage` therefore skipped its
`children ?? sourceText` fallback and rendered an empty user bubble. The
assistant entries still rendered, explaining why only messages 1 and 3 appeared.
`contracts/v1/history.schema.json` permits omitted or empty `blocks`; the
browser fixture's plain user entries are valid and its content assertion is
still the right contract.

Fix `50bfc0f9` only supplies custom children when a skill or nonempty typed
blocks exist. Otherwise the original plain-text fallback renders the native
prompt. The browser spec, paging fixture, assertions, retries and timeouts are
unchanged. Unit coverage checks both absent and empty blocks, exact native
text including a newline, and inert script-looking text.

## Evidence

Base: `49e89404`; runnable fix: `50bfc0f9`.
All commands used `umask 077` and a fresh
`export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX)`; focused scripts themselves reset
TMPDIR to `/var/tmp`. Browser commands use the fleet's Cedar warm-slot routing.

- Before the fix, focused `HistoryView` regression (`npx vitest run
  src/app/HistoryView.test.tsx -t 'preserves plain user text'`) failed with
  expected native prompt versus received empty text, independently of paging.
  Initial attempt before installing web dependencies could not load Vite;
  `npm ci --prefix web` resolved that prerequisite.
- `./scripts/test-focused.sh --area web`: passed format, lint, typecheck and
  all 554 tests in 93 files, including the new plain-user cases and existing
  typed-block/skill tests.
- `./scripts/test-focused.sh --area browser --spec spinoffs.spec.ts`, repeated
  five consecutive times: 4/4 passed each run (20/20 total), using four
  concurrent Playwright workers. Reported suite times: 15.1s, 13.5s, 14.1s,
  14.0s, 14.4s; entire loop including routing/build/queueing took 424s.
  This is a deterministic content regression, not a load-dependent wait flake.
- `git diff --check`, `issuectl doctor --json` and
  `python3 scripts/validate-project-view.py`: passed; doctor reports existing
  non-AVIF image advisories elsewhere, with no schema violations.

## Review and limits

Focused self-review: the change is entirely within the existing presentation
fallback, with no contract, identity, authority, network or daemon-state change.
Checked that skill arguments and typed/image blocks keep their existing paths
and plain text stays escaped. No independent cross-boundary review required.
No tests were removed or weakened. No new product choices for later review.
Evidence is synthetic host/browser and client-unit evidence, not live Pi,
provider or distinct-UID acceptance. Full clean gate belongs to the conductor.
