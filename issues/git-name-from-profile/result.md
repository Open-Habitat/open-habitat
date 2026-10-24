# Result

The saved account profile name now supplies the initial Git name in first-login onboarding. The field remains editable; native identity saves and existing Git identity precedence are unchanged. An absent profile name still falls back to the native GitHub suggestion. Settings do not receive the profile-name preference.

## Validation

Implementation tree: `f227557a7b7f6a6d0b85ca56147953eca3753e58` on baseline `33ed6a408436a9d908318782fc854a04a15723e8` (before issue closure/evidence).

- `./scripts/test-focused.sh --area web`: passed formatting, lint, typecheck and all 705 tests in 109 files on the final inputs.
- `./scripts/test-focused.sh --area browser --spec github-first-onboarding.spec.ts`: passed all 5 cases, including the axe audit. Executed through the Alder npm/npx shim on the Cedar warm runner. The changed case enters a missing profile name, sees it prefilled at the Git step, edits it, confirms and verifies native Git readback. The first run exposed an existing expectation for the old GitHub-suggested name; that expectation was updated to the profile name and the whole touched spec rerun successfully.
- `npm run storybook:test --prefix web`: passed with new production-component stories for profile prefill and missing-profile fallback.
- `git diff --check`, `python3 scripts/validate-project-view.py`, and `issuectl doctor --json`: passed.

Evidence is synthetic, host-backed browser behavior, not live GitHub or distinct-UID isolation. No full gate or live deployment was run. No visual layout changed. The manual check is listed under Käyttöönoton testaaminen in `KOKEILTAVAA.md`, marked not yet deployed.
