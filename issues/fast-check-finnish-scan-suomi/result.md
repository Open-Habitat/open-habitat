# Result

Allowed only the exact `Suomi` literal in `components/LanguageSettings.tsx`, with the endonym rationale. Other Finnish strings remain checked.

Validation: `cd web && ./node_modules/.bin/vitest run src/i18n/finnishScan.test.ts` passed (2 tests) on the commit carrying this result. Self-review: narrow test allowlist only; no product behavior changed.

## Decisions for later review

None.
