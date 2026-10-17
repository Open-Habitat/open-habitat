---
created: 2026-10-17
updated: 2026-10-17
type: task
reporter: jari
status: open
priority: high
lane: unlaned
collision: [design-system/prototypes/rounds/proto-repo-selection]
preparation: ready
---

# Prototype: choosing and cloning a GitHub repository as a new workspace

Jari, 2026-10-17 ~07.00: "Tää GitHub-kloonaaminen pitäisi miettiä uudestaan. Haluan prototypata näitä repon valintaan." Creating a workspace by cloning: today a dialog with a repository search and Luo työtila (`archive-workspace-restore`/`new-workspace-dialog-stays` made it a streaming progress view). His live attempt to clone `northwind-monorepo` (a large repo) was cut by a release restart and left a broken 910 MB `.git` with no commits, shown as a workspace that cannot be deleted.

Prototype the whole path from "new workspace" to working in it: finding the repository (own, organisations, recent, search; the earlier decision is that all repos are visible and time filtering is the user's choice), what is shown about a repo before cloning (size, default branch, last push), large repos (size warning, shallow/partial clone option?), progress, cancel, failure and retry, and what a half-finished clone looks like afterwards. Three directions on one named axis.

## Acceptance Criteria
- [ ] Round verified with check.mjs; result.md per the prototype worker rules with questions for Jari.
