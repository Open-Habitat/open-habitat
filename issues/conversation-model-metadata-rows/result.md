# Result

Startup model/thinking entries now establish a silent baseline. Repeated native values are silent too; a different known value produces one compact row per change. A real switch before the first prompt is preserved. A partial history window with no previous setting does not invent a transition. Compaction remains visible.

The production `SessionSettingsRow` uses the existing model/thinking presentation helpers: e.g. **Opus 5.5 → Fable 5.1**, without provider/model IDs or a redundant copy control. Its Storybook stories cover model, thinking and compaction. No chip/picker, shared state ownership, contracts, Go or styles changed. Updated the design description to carry Jari's newer decision; the older prototype's startup row is intentionally superseded.

## Evidence

Runnable source: this fix over `7ddc790c` (later edits only issue/design/evidence).

- `npm ci --prefix web`: passed.
- Focused web checks via the supported Cedar warm runner, with an explicit two-worker budget: **537 tests / 93 files passed**, plus format, lint and TypeScript. Command: `TMPDIR=/var/tmp PYTHONPATH=$HOME/.local/lib/fleetrepo/execution-runner python3 -m hbexec.warm --source "$PWD" run -- env OH_WEB_WORKERS=2 bash scripts/test-focused.sh --area web`.
- `./scripts/test-focused.sh --area browser --spec lab-model-rows.spec.ts`: **1 passed**, including Axe at 1440/390 px, light/dark. Synthetic native-history-shaped records are injected into the real isolated lab history read, followed by reload. Checks distinguish startup/no-op silence from real changes and their repeated confirmations. This is synthetic browser/host presentation evidence, not live provider or distinct-UID evidence.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`: passed. Doctor retains only unrelated existing image advisories.
- Go, contracts and the full clean gate were not run: their boundaries are unchanged.

Logs: `/var/tmp/model-rows-{npm,web,web-final,browser}.log`; doctor: `/var/tmp/model-rows-doctor-final.json`. Captures were fetched from this worktree's exact remote warm workspace.

## Focused self-review

Compared all four `evidence/model-rows-{1440,390}-{light,dark}.{avif,html}` captures with the Agentin vuoro prototype's subdued setting-row family and the current design tokens. Existing conversation surfaces, reading column, bubbles and tool summary remain unchanged; real transitions fit on one line at 390 px and have no raw identifiers. The prototype's initial setting row is omitted as explicitly requested. No separate reviewer was needed: the change remains a pure presentation projection with no new shared state, contracts or daemon behavior.

The replaced model-copy test deliberately required the old startup row and raw code-formatted ID; those behaviors are now unwanted. It is replaced by startup-silence coverage. The extended timeline test still protects actual transitions, compaction and hidden session-info entries; another case protects a real switch before the first prompt and unknown-history baselines.

## Tool/sub-workflow inventory

- Exploratory searches used nonexistent lowercase `conversation*` and `model*` app paths; actual rendering is `HistoryView.tsx`, `sessionSettings.ts` and capitalized production components. A guessed `ConversationMessages.stories.tsx` also did not exist; added a story beside the extracted production row instead. No required discovery remained blocked.
- Initial prerequisite inspection found no installed Vitest; `npm ci --prefix web` resolved it before testing.
- A guessed warm-runner `hbexec/ssh.py` lookup failed; inspected the actual `warm.py` and used its strict pinned SSH route to retrieve the eight capture files successfully.
- An initial complete web pass covered the earlier projection. After refining the pre-prompt-switch behavior, reran the complete focused web checks successfully. Browser evidence covers the final runnable source. No required command, review or service remains incomplete.
