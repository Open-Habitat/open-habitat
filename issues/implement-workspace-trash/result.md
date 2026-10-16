# Result: workspace deletion via the home Trash (backend)

## Yhteenveto Jarille

Työtilan poisto toimii nyt palvelimella ADR 0019:n mukaan, mutta selaimessa roskakoripainike on yhä estetty, koska käyttöliittymä odottaa valintaasi prototyypin suunnista ([implement-trash-ui](../implement-trash-ui/item.md)). Poisto siirtää työtilan `~/.local/share/Trash`iin, josta sen voi palauttaa selaimesta tai `gio trash`illa / `trash-restore`lla. Puhdas, kokonaan pushattu Git-klooni poistetaan suoraan (muutoksesi). Estot ovat ADR:n mukaiset, ja jokaiselle on testi. Ratkaistavaksi jäävät prototyyppikierroksen viisi kysymystä; niistä ohitettujen tiedostojen ja hakemisen ennen pysyvää poistoa vastaukset voivat vaatia pienen backend-muutoksen.

## What was built

- ADR 0019 is Accepted with Jari's amendment (`docs/decisions/adr-0019-workspace-deletion.md`).
- Six actions on `POST /api/v1/workspaces` (`internal/daemon/workspace_delete_linux.go`): `delete_check` (read-only; outcome `blocked` / `trash` / `permanent` with blockers and Git facts), `delete` with `disposal: trash|permanent`, `trash_list`, `trash_inspect`, `trash_restore`, `trash_delete` (typed name).
- Trash layer (`workspace_trash_linux.go`): info file first with `O_EXCL` and fsync, `renameat2(RENAME_NOREPLACE)`, comparison of the moved inode with the observed one, swapped directories put back or left whole and reported (`replaced`). Strict `.trashinfo` parsing; only entries whose `Path` is an immediate `~/src` child are listed, plus directories without an info file (`unlabelled`). Info files without an entry are removed by listing after a two-minute grace, so another tool's move in progress is left alone. Permanent removal is a descriptor walk that follows no symlinks and enters no mount, that removes the info file last, makes owned read-only directories writable, and reports what remains.
- Checks (`workspace_delete_checks_linux.go`): `/proc` scan of the person's processes (cwd, root, exe, every fd) with unreadable processes blocking, Taskfleet `run list --repo`, Git's `worktrees/*/gitdir` registry including locked entries, gitfiles of the workspace and its children, `/proc/self/mountinfo`, and the Trash device. Git facts: changed, untracked, ignored (with up to 20 paths), stash, commits not in any remote-tracking ref, last fetch.
- Controller fence (`workspace_fence_linux.go`): keyed by device and inode, refused while a live Pi child runs in the workspace. `workspaceFD` and all four Pi launch sites (create, relaunch, resume, title) admit a descriptor only if no fence holds it and `~/src/<name>` still names that directory, checked under `c.mu` together with the launch, so a start resolved before a move cannot launch in the Trash.
- Contract `contracts/v1/workspace-deletion.schema.json` with two examples and two negative checks; browser client `web/src/app/workspaceTrash.ts` validating every reply.
- The disabled trash button and its reason text are unchanged.

## Evidence

- `go test ./internal/daemon -run 'Trash|WorkspaceDelet|WorkspaceFence'`: 10 tests, covering each ADR blocker (live Pi, real `/proc` process, unreadable process, zombie not blocking, live Taskfleet run, Taskfleet failure, linked, locked and stale worktree, workspace that is a linked worktree, container of worktrees, mount, unreadable mountinfo, other filesystem), the amendment's negatives (untracked, changed, unpushed, stash, unpushed side branch, no remote), the recheck on the moved inode (late write, process entering), a swap before rename (put back, and not restorable), `EXDEV`, a crash after the info file, an interrupted restore, an interrupted permanent deletion, symlinks out of an entry, foreign/forged/escaping info files, restore over a taken name (case-insensitive), the fence, and request grammar. Mutation checks: disabling the nested-repository rule, `--all`, the descriptor-still-named admission, the mount check before `trash_delete`, the name shortening, the inode comparison, the stash or untracked conditions, the grace period, the moved-inode recheck, the Taskfleet worktree-exists rule or the `~/src`-child path rule each fails a test.
- Every 200 reply produced by those tests (69, nine states) validated against the schema with the Python validator.
- Full `go test ./internal/daemon`: only the six known pre-existing Pi credential/device/model/startup failures.
- `lab-workspace-trash.spec.ts` (lab host, real gateway and CSRF): create, check, refused permanent, trash, list, restore, trash again, permanent delete; a request without CSRF is 403. This is host-backed synthetic evidence; there is no UI journey yet, so no screenshots.
- Web: `vitest run` 56 files / 315 cases, `test-web-fast.sh`, biome, contracts focused check, `validate-project-view.py`, gateway tests.
- On alder, the real `/proc` scan first found 10 unreadable same-UID processes. They were zombies (`fd` denies reads), which would have blocked every deletion; zombies are now ignored, and the same scan finds none.

Not verified: the test server (no UI to exercise it, and the brief said not to change it), real Taskfleet runs (the fixture is a script returning Taskfleet's JSON shape), distinct-UID isolation (unchanged authority; the daemon touches only its own home).

## Review

Independent `/llm-review` at critical rigor (destructive operation, daemon state, contract): finder Claude Fable 5.1, verifier GPT-6 Astra, two calls. Six of seven candidates survived local checks and the verifier; all six were fixed with regression tests and mutation checks:

1. The permanent walk crossed same-filesystem bind mounts (same `st_dev`). It now opens children with `openat2(RESOLVE_NO_XDEV)`, and both permanent paths check mountinfo for the entry first. The bind-mount case itself is not test-proven: unprivileged user namespaces are disabled on alder, so the fix rests on documented kernel semantics.
2. Outright deletion missed unpushed commits in submodules and ignored nested clones, and in refs other than branches and tags. Now `nested_repositories` must be 0 and `rev-list --all` is used.
3. The title-generation Pi launch (`history_title_linux.go`) had no admission check; it now checks under `c.mu`.
4. The departed-inode set refused natively restored workspaces and reused inode numbers until daemon restart. Admission now compares the descriptor with what `~/src/<name>` names.
5. The permanent path reopened the entry by name after verifying it. The verified descriptor is now rechecked and walked, and the name is removed only if it still is that directory.
6. Names of 246–255 bytes could not be trashed. Entry names are shortened to 230 bytes; the info file keeps the full path.

Dropped: unreadable processes not blocking `trash_delete` is deliberate (decision below).

## Decisions for later review

- Initialized submodules and ignored nested Git repositories prevent outright deletion (they go to the Trash): their commits are not checked against a remote. Uninitialized submodules (only `.gitmodules`) do not.
- Ignored files do not prevent outright deletion; they are counted and up to 20 paths listed for the confirmation (prototype question 2 is still open to Jari).
- "Pushed" means contained in a local remote-tracking ref; no fetch is made (question 3). Commits reachable only from the reflog are not counted.
- Outright deletion moves first, rechecks Git facts and processes on the moved inode, then removes; a change keeps the entry in the Trash with `kept_reason`.
- The Trash is always `~/.local/share/Trash`; `XDG_DATA_HOME` is not trusted configuration in the daemon.
- Taskfleet is asked with `--repo <workspace>` only for Git workspaces; a container of worktrees is caught by the gitfile check of its children. A run blocks when pending/running or when any of its worktrees still exists, so a merged run whose worktree is gone does not block.
- Processes of the person whose details cannot be read block deletion, except Pi's existing list of known system services and zombies. Permanent deletion of a Trash entry blocks only on a process found inside it, not on unreadable ones.
- Size is included (allocated bytes, 1.5 s / 200 000 entries bound, `size_complete` otherwise), since the prototype shows it.
- Directories in the Trash without an info file are listed as `unlabelled` and can be deleted (typed entry name) but not restored.
- `trash_list` and `delete_check` are POSTs with CSRF, like the rest of the route.
- The workspace route's write deadline is extended to about 2.5 min for these actions; the permanent walk has a two-minute bound independent of the browser.
- Vitest now also runs `*.test.ts`; six existing unit files had never run (all pass).
