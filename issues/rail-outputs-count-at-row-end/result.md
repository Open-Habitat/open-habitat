# Result

Tuotokset's count now occupies the trailing slot in ordinary and adaptive
place rows, sharing the browser state's muted metadata typography. The
adaptive icon/tile badges, zero-count omission and accessible naming remain
unchanged. The collapsed ordinary rail hides the separate count as it hid
the former label/count span.

## Decisions for later review

- Use quiet metadata, not an accent pill, in expanded rows. The rail-space
  rounds 2/3 show end badges, but this counter is the number of public
  addresses (`useSharesCount`), not new/unread items. Matching Oma selain's
  quiet state avoids implying attention. Icon/tile badges retain their
  existing treatment.

## Verification

Tested the implementation diff on base `cda5637c18ec2e087188d963d4b9e7ad44e463fe`.
All commands ran under umask 077, scratch lease and outer timeouts.

- `./scripts/test-focused.sh --area web`: passed static checks and all
  2,143 tests in 255 files after the final source/test edits.
- Focused browser entrypoint: ordinary place-toggle spec passed (5 cases);
  new count cases passed with synthetic address replies and paired captures.
- `npx playwright test --config playwright.lab.config.ts tests/lab-adaptive-rail.spec.ts --repeat-each 3`:
  30 passed, including the existing accessibility check and new desktop/phone
  count geometry checks with the experiment off/on. The adaptive case visits
  all three allocation steps and checks compact badges remain within controls.
- `npx playwright test tests/rail-place-toggle.spec.ts tests/server-browser.spec.ts --repeat-each 3`:
  48 passed. Both repeated runs used two workers and 0–60 ms reply jitter.
- Inspected the four synthetic desktop/phone screenshots (experiment off/on).
  Paired PNG/HTML evidence: `/var/tmp/agent-keep/rail-outputs-count-at-row-end/`
  (`desktop-false`, `desktop-true`, `phone-false`, `phone-true`).
- Focused self-review: appropriate for markup/CSS-only layout change, with no
  session, contract, daemon or authority changes. Checked zero/collapsed states,
  unchanged naming and compact badges, shared style import through Navigation,
  and browser state overrides. No remaining finding.

Initial checks exposed a missing local Pi test dependency and an incomplete
synthetic address setup (the list is read on opening Tuotokset and entry URLs
must use this origin). Installed the fixture dependencies and corrected the
test; all final checks above passed. No whole-suite, Go, packaging or live
installation claim is made: these are synthetic browser layout checks.
