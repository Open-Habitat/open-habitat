# Result

Regenerated the two stale editor references. Fast web checks now run the same
read-only drift check as packaging, before npm, and print the generator command
on drift. The focused web entrypoint inherits it from `test-web-fast.sh`.
Updated `web/AGENTS.md` to name both fast entrypoints and regeneration for UI text.

## Evidence

On base `2bb15358daf89659b1089c0252e9d9d1227f54ef` plus this issue's diff:
- `python3 scripts/test-ui-reference.py`: 2 tests passed. The new disposable
  checkout test exercises both actual shell entrypoints: fresh references reach
  stub npm; changed source refuses before npm and names the fix command.
- `npm ci --prefix web` and `./scripts/test-focused.sh --area web`: passed
  static checks, typecheck, 161 test files / 1185 tests.
- `python3 scripts/generate-ui-reference.py --check`: passed.
- `python3 scripts/validate-project-view.py` and `git diff --check`: passed.

Focused self-review: confirmed generated diffs reproduce browser sources, the
shared hook covers both entrypoints without a duplicate check, and drift fails
without silently rewriting shipped inputs. No production behavior, contracts,
Go implementation or browser specs changed. No full gate, browser suite or
release build run; actual deployment remains the conductor's verification.

After rebase onto `2ccf25e84da982f4c3a7995df947102abbdd7709`, regeneration
produced no further changes and both Python tests passed again. The first full
fast-web rerun timed out at 5 seconds in three unrelated tests
(SpinoffConversation, GitLabConnection, Integrations); an unchanged full retry
passed all 1185 tests. `issuectl doctor --json` exited 0 with no schema errors
and reported 471 existing non-AVIF images outside this change.

## Decisions for later review

No missing product facts or product decisions. Chose the shared fast-web script
rather than duplicating checks in its focused wrapper, to cover both commands
with one implementation.
