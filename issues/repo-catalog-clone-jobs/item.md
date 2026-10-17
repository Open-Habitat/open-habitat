---
created: 2026-10-17
updated: 2026-10-17
type: feature
reporter: jari
status: open
priority: high
lane: repo-clone-host
lane_seq: 1
collision: [internal/daemon/github, internal/gateway/github_clone, contracts/v1/]
preparation: ready
---

# Repo catalog, any-repo lookup and clone jobs that outlive the stream

Host side of the repo-selection flow Jari chose on 2026-10-17 (`proto-repo-selection`, direction **Kloonaussivulla**). Read `issues/proto-repo-selection/result.md`, especially "Host facts the views assume" and "Jari's decision". The browser page is a separate issue (`repo-selection-page`) that builds on this contract.

- **Whole catalog.** The daemon reads all `/user/repos` pages (bounded, about 10 x 100) or searches on the server, sorted by `pushed_at`, and passes `size`, `default_branch` and `owner.type`. Today's suggestions come from page 1 only, so most organisation repos are never offered.
- **Any repo by exact name.** An exact `owner/repo` that is not in the user's catalog (Jari searched the public `raine/workmux` and got nothing) is looked up on GitHub with the user's own `gh` credentials and returned, or answered with a concrete not-found / not-accessible result.
- **Clone job outlives the HTTP stream.** The daemon owns the `git clone` process; the browser subscribes and resubscribes to its progress, and leaving the page does not cancel it. The job lives in memory only (no new store, per CLAUDE.md); a daemon restart loses progress and recovery comes from the filesystem.
- **Light clone is a choice** on the clone request (`--filter=blob:none`); full history stays the default.
- **Failure and cancel clean up** the directory this request created, so a retry is no longer refused with `checkout_exists`.
- **Interrupted clone recognised natively**: `.git` and `origin` exist, no `HEAD` commit, no `git clone` running there. Expose it as a state such as `interrupted` with its byte size, hide such directories from the workspace list, and provide the explicit actions "Aloita alusta" (remove and start again, full or light) and "Poista keskeneräinen". Never restart a clone automatically.
- **Free quota** for the details pane from the existing quota read.

The daemon trusts no identity claim from the browser or gateway; every git and gh call runs as the user. Contract changes go through `contracts/v1/` and the generators.

## Acceptance Criteria
- [ ] Contract and daemon support the above; host-backed tests cover an organisation repo beyond page 1, an exact public `owner/repo` lookup, a clone surviving the stream's disconnect, cancel and failure cleanup, and an interrupted clone after a daemon restart with both explicit actions.
- [ ] The existing dialog keeps working until `repo-selection-page` replaces it.
