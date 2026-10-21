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
