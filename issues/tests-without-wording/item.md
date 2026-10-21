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
