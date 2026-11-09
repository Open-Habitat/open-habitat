# Result

Removal dialogs, cleanup lists and outcome notices now share the list's task/helper name in Finnish and English. Generated names without an owner title use a readable Leftover/Jäänne label. Native paths and branches remain in Git details (and storage-list metadata), not in removal prose. Saved work is described as retained, either merged into the workspace or available for the workspace agent to restore. Force deletion still warns about unsaved/ignored files; detached history is not promised preservation.

## Checks and review

- Focused self-review of the naming call sites, all removal outcomes and both catalogs. Explain cards do not quote the replaced messages and remain accurate; no new controls.
- `./scripts/test-focused.sh --area web`: 200 files, 1510 tests passed, including WorktreeAttention and WorktreeList. Regression coverage checks native identifiers do not leak into task-named confirmations/notices and that typing the task title still sends the native confirmation expected by the host.
- `OH_PORT_BASE=15900 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec lab-worktree-cleanup.spec.ts --spec cross-workspace-agents.spec.ts`: both specs passed (one case each), under umask 077 and disk-backed TMPDIR. Host-backed synthetic evidence, not live-host or user-isolation evidence.
- Initial web runs caught formatting and an incomplete test result fixture; both corrected and final web checks passed.
- No screenshot/layout comparison or live recovery exercise performed. No daemon, contracts, session state or authority changes.

## Decisions for later review

- Use the same shared name in the storage list too, rather than retain raw headings there and have its dialog disagree. Its technical metadata remains available.
- For generated names without an owner title, remove the generated prefix/id and space the remaining words under Jäänne/Leftover. Alternative: repeat the full directory name; rejected because it recreates the reported problem. User-supplied non-generated directory names remain unchanged.
- Force-delete confirmation asks for the displayed title and translates it to the existing native name only after an exact match. Alternative: make the person type the raw internal identifier; rejected as inconsistent with the row they selected. Host validation and target identity are unchanged.
- Recovery wording directs the person to the workspace agent, rather than displaying a Git command or inventing a restore control. The retained branch is accessible to that agent; merged work already remains in the workspace.
