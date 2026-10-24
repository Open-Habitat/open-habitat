# Result

Apple was already in the production catalog order and the shared row renderer. The Storybook catalog omitted it; it now supplies Apple as available and includes its onboarding step. No duplicate row or special-case status logic was needed.

Added the short own-Integraatiot explanation. Extended component coverage for Apple without a credentials action, its ready onboarding badge, and the missing-tool status/hidden badge/fix action. Extended the existing host-backed browser journeys for Apple's native catalog availability, absent/present onboarding badge after saving a real onboarding step, and the explanation's presence (not its wording). Existing desktop/phone collision and axe checks include Apple with its badge. KOKEILTAVAA.md includes the live acceptance step.

## Verification

Tested implementation tree: `ce175a8e6d033d996eea835619e5224266e420af` (base `c44558a5f9f6b3e59d2f8e4b4b18e4f35bd1e2b1`, before issue closure/result metadata).

- `./scripts/test-focused.sh --area web`: passed, format/lint/types and 111 files / 713 tests.
- `npm run storybook:test --prefix web`: passed.
- `./scripts/test-focused.sh --area browser --spec server-integrations.spec.ts`: passed, 4 cases, including axe and desktop/390px collision/overflow checks, via Fleetrepo's remote Chromium runner. Initial added test forgot to open the onboarding integration picker; corrected and rerun. Final web/browser validation passed after formatting.
- `python3 scripts/validate-project-view.py`: passed.
- `git diff --check`: passed.
- `issuectl doctor --json`: passed with existing repository image advisories; no schema violations.

Synthetic same-UID browser/host evidence only, not real Apple provider behavior, UID isolation or live deployment. No full clean gate, deployment or new visual captures were performed.
