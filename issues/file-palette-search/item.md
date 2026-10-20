---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: fixed
priority: normal
lane: composer
lane_seq: 5
collision: [web/src/components/composer]
closed: 2026-10-20
---

# Ctrl+P file picker: odd 'changed first' section, and a query with spaces finds nothing

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: the Ctrl+P (⌘P) file picker opens with a 'changed first' section that felt odd, and a query like 'skill tr' (with a space) shows nothing. Space-separated terms should each match (fuzzy, order-insensitive or path-segment aware like VS Code's quick open). Reconsider the changed-files grouping (e.g. a subtle marker in a single ranked list). Tests for multi-term queries.

## Acceptance Criteria

- [x] Space-separated file-search terms all match fuzzily, independent of term order.
- [x] Ctrl+P opens all files in one ranked list with Git badges; changed-only remains an explicit filter.
- [x] Regression coverage includes missing terms, whitespace/case, rank preservation, keyboard multi-select and picker accessibility.

## Result

Implemented in taskfleet run `01m5d659mzsnmygp5yn8w73fg2` from main
`043f52b3306da8df135a9c5ccb952ed00b91394e`. Runnable implementation and tests
are the staged tree `b1543e77032e2bba20c53b56cf6ff806468c8db1` (before this issue update).

Every query term is scored against the path; a missing term rejects the file.
Terms may appear in any order and case. Blank input preserves source order,
without promoting changed paths. The browser preserves that ranking in one
group and opens the all-files tab. Changed-only stays available deliberately.
The obsolete changed-first assertion was removed; its distinguishing behavior
is now explicitly rejected by the new rank-preservation regression. Existing
file containment, ignored-file and Git-status assertions remain intact.

Focused self-review was proportionate: only ranking and presentation changed;
no filesystem traversal, authorization, identity, contract or install authority
changed. Accessibility checking also corrected preview heading hierarchy and
made its scroll region focusable, preserving its styling.

### Verification

All runs use the synthetic remote Linux ARM64 runner, not the live server.
The remote jobs install the pinned Pi SDK fixture before daemon/browser tests.
Commands use `TMPDIR=/var/tmp`; daemon/browser runs use `umask 077`.

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed,
  job `358ebdfef9bd8346fffe1dfa13301d72886bd17633fc441e46d69f602956e1a9`.
  Go sources have not changed since this run.
- `./scripts/test-focused.sh --area web`: final pass (format, lint, typecheck,
  pure unit and component tests), job
  `539bca23a253413522097bb36878339b920eab1d2568bc30141bf6de906887c3`.
- `./scripts/test-focused.sh --area contracts`: passed,
  job `35bab60562e4334e3f064c16b75317fd54dfbec7c2314ce48f004c8905bfffbd`.
- `./scripts/test-focused.sh --area browser --spec lab-composer-area.spec.ts`:
  final job `b2e12c69ffbdd00bf447e3c5a7406126f38ae3ead55dee23141a24a6827b0a42`
  has four passing cases, including the extended Ctrl+P multi-term search,
  Git badge, missing-term result, Axe check, multi-select insertion and Esc
  focus-return journey. Two unrelated cases still fail: the mode-chip keyboard
  focus expectation and the phone-label expectation (three hidden labels vs
  two, following the added attachment control).
- The identical browser command on a clean disposable clone of unchanged main
  `043f52b3306da8df135a9c5ccb952ed00b91394e`, job
  `d27dc4d852d94c1c2fcd7bf402ed631a4c4eaf8a3a17b74372269a145a228731`,
  reproduces exactly those two failures, with four cases passing. These meet
  the task's pre-existing-failure exception; the suite is not claimed green.

### Failure inventory and limits

Initial browser attempts exposed an ambiguous new badge selector (scoped to
its option), Axe running before search results reloaded (now waits for results),
and existing preview heading/keyboard-scroll accessibility defects (fixed).
Final palette behavior and Axe pass. The first web check after adding keyboard focus
failed Biome's noninteractive-tabindex rule; added the same narrowly justified
scroll-region exception already used in OutputBox and ProcessTray. A local
single-file Biome check and the final complete focused web check both pass.
Only a lint comment changed after the final browser run. Inspection searches against a nonexistent
composer test glob and absent optional directory instructions returned nonzero;
subsequent discovery found `composer_linux_test.go` and the applicable root
instructions. No required review was omitted and no independent model was used.

Before/after captures deferred: Alder prohibits local specialist browser/lab
execution; the maintained remote spec supplies host-backed synthetic browser
and Axe evidence, not a manually captured visual comparison. No full gate,
separate-UID isolation proof, live-provider test or test-server deployment was
performed. No push or Fleetrepo change is required from this worker.
`git diff --check`, `python3 scripts/validate-project-view.py` and
`issuectl doctor --json` also pass. No failed or pending required check remains
except the two explicitly baselined browser failures described above.
