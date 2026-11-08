# Result

Markdown block previews, worker work summaries and Raise / Not now are ordinary features. Removed the three switches, their cards and translations, settings-search entries, presentation gates and off-path tests. Explain mode now says that reading a reply does not dismiss it. Regenerated the agent UI reference from source (also refreshing its previously stale generated copies; no daemon implementation changed).

## Decisions for later review

- Old saved experimental IDs are ignored, not proactively deleted from the daemon's account file. Alternative: migrate account storage. Nothing reads those IDs now, and retaining inert keys avoids an unnecessary write/migration and preserves all remaining choices. The existing unknown-ID preference test now supplies all three retired IDs.
- Removed their settings-search results rather than redirecting to another setting: these features have no setting anymore. Other experimental features retain their existing switches.

## Validation and review

Tested the implementation on top of `85fd2fe55` on Birch, with a private disk-backed TMPDIR, umask 077 and both npm fixture packages installed. Focused self-review of the three always-on paths, removed branches, catalogs, obsolete preferences and selectors; no session-state owner, daemon logic, contract or authority boundary changed.

- `./scripts/test-focused.sh --area web`: 190 files / 1430 tests passed, including Markdown preview, rail grouping and account preferences; lint, types and catalog checks passed.
- Named `--area browser --spec NAME.spec.ts` runs, each separately with `OH_BROWSER_WORKERS=2 OH_PORT_BASE=18400`: `settings-experimental` (3), `worker-row-sentence` (1), `raise-to-your-turn` (1), `markdown-block-preview` (1), `lab-worker-row-sentence` (1), all passed after final changes. Includes fresh-account defaults, two-device marks, native Git worktree summaries, preview keyboard focus/source copying, phone layout and existing axe checks. This is synthetic host-backed evidence, not live-host or separate-UID evidence.
- `python3 scripts/generate-ui-reference.py --check`, `python3 scripts/validate-project-view.py`, `git diff --check`: passed.
- `go test ./internal/daemon -run TestUISkillRestoresAllReferences -count=1`: passed.
- Full focused daemon package run: failed only at the existing `TestAgentCommandPathIsPerHomeAndInherited` expected-PATH assertion after installing Python requirements. Reproduced separately on main (`217deac50`); already tracked as `agent-path-test-misses-core-tools`, so not duplicated or modified here. No claim of a green daemon suite.

The deleted tests proved the explicitly retired off behavior (no preview, no worker work reads, and reading a reply moving it to Quiet). Remaining tests exercise the same enabled behavior without setting anything first; generic switch confirmation/failure coverage now uses a remaining experimental feature.

Initial checks exposed formatting differences (formatted and rerun), missing Python `referencing` (installed requirements in a disposable uv venv), and a leftover off-path assertion in the Raise browser spec (removed, rerun passed). A command with repeated `--spec` flags ran only the last name; all five specs were subsequently run individually. No full browser suite, clean gate, deployment or push was performed.

The first merge attempt met overlapping KOKEILTAVAA edits on main. Rebased, retained both workers' additions and main's intentional removal, regenerated references from the integrated sources, and reran all 1430 web tests, all seven named browser cases, reference drift/restoration and project-view validation successfully.
