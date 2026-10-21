---
created: 2026-10-21
updated: 2026-10-21
type: chore
status: open
priority: high
lane: unlaned
preparation: ready
---

# Stop testing UI wording: locate by role and test id, drop copy assertions

## Description

Jari 2026-10-21: UI wording must not be tested (rule now in TESTING.md 'Test value'). Browser and component tests locate ~1800 elements by accessible name, use getByText ~430 times and assert text ~300 times across ~89 spec files plus Vitest component tests, so every copy change (e.g. Pi -> agentti) breaks many tests. Rewrite to role + stable data-testid locators, add the test ids to production components where needed, and remove assertions on wording unless the text is itself the contract (no leak of provider/other-user data; native content shown unchanged). Keep behavior assertions; axe audits keep checking that accessible names exist. Done in batches by spec file.

## Agent Runs

### 2026-10-21T04:54:56Z · @pi

Batch B: migrated all 28 assigned specs to purpose test IDs/roles and state/behavior assertions, retaining native content and identity-leak checks. Added minimal production hooks/forwarding; no cases removed. Self-review and git diff --check passed. On 1a8fb49d (rebased onto cb203365), test-web-fast.sh passed 488 tests (23 s), all 69 ordinary browser cases passed (36.1 s Playwright; 160 s routed command), and all 10 lab cases passed (6.1 s Playwright; 33 s routed command). Host-backed synthetic evidence; no full gate. Shared web/tests/git-identity-helper.ts still uses named locators and is outside this batch's file ownership; the conductor should migrate it using the new git-identity hooks. Issue deliberately left open for the other batches.

### 2026-10-21T05:02:54Z · @pi

Batch C (taskfleet:01m5ebhenaq6xwjjvf4evcx1fh): converted all 22 assigned specs to copy-independent locators and behavior/state checks, retaining every case and timeout plus native-content and leak assertions. Shared component changes are test attributes/forwarding; batch B IDs preserved during rebase. Self-review complete. Final combined-tree checks: test-web-fast.sh passed 488 tests (23.79 s); assigned ordinary Playwright specs passed 51, with the existing opt-in visual case skipped (39.53 s wall); assigned lab specs passed 24. No full gate; issue left open for the other batches.

### 2026-10-21T05:18:08Z · @pi

Batch D (run 01m5ebhfjq23q2sc4vv5wcmk34): rewrote all 12 assigned browser specs and all Vitest UI tests to stable controls/state markers; retained native-content and non-disclosure assertions. Removed 17 wording-only cases (named in commit bodies), without reducing behavioral timeouts. Rebased against batches B/C and preserved their shared test IDs. Self-review: no accessible-name locators remain in this batch. Validation: test-web-fast.sh passed 81 files / 471 tests (22.01 s wall); assigned default Playwright specs passed 50 cases with the same 2 capture-only skips; synthetic-demo passed all 8. No full gate; issue left open for the conductor.
