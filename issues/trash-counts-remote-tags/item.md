---
created: 2026-10-19
updated: 2026-10-19
type: bug
reporter: jari
status: fixed
priority: normal
lane: workspace-trash
lane_seq: 1
collision: [internal/daemon/workspace-delete]
preparation: ready
closed: 2026-10-19
---

# Trash check counts commits of fetched tags as local-only

Jari on the test server (pilot.231), 2026-10-19: cloned `raine/workmux` from the repo page, made no changes, and moved it to the trash. The dialog said "Roskakoriin eikä suoraan pois, koska tämä on vain täällä: 457 committia, joita ei ole etärepossa". He had committed nothing.

Conductor checked the trashed clone (`~/.local/share/Trash/files/workmux` on the VM): `git rev-list --count HEAD --not --remotes` = 0, `main` = `origin/main`, 273 tags, and `git rev-list --count --all --not --remotes` = **457**. So the check counts commits reachable from tags (fetched from the remote) as local-only. Tags that exist on the remote are not local work. Fix the "only here" check (`internal/daemon` workspace delete checks) so it counts local branches (and local-only tags, if any can be determined cheaply, e.g. tags not present in the remote's advertised refs or not reachable from remote branches and not fetched) — decide and record. A fresh clone of a repository with many tags must offer **Poista pysyvästi**.

## Acceptance Criteria

- [x] A fresh synthetic clone with remote-only release-tag history reports zero local-only commits and can be deleted outright.
- [x] Local commits, side-branch commits, stashes and unique local-tag history remain protected.
- [x] Remote tag verification failures and tags removed during deletion prevent outright deletion.
