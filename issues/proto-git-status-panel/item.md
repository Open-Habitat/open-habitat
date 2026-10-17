---
created: 2026-10-17
updated: 2026-10-17
type: task
reporter: jari
status: in-progress
priority: high
lane: unlaned
collision: [issues/proto-git-status-panel]
preparation: ready
---

# Prototype: Git status in the agent view

Jari, 2026-10-17: "olisi kiva, että siinä agentti-ikkunassa on mahdollista saada näkyviin tavallaan git-statistiikat. Eli missä branchissa ollaan, mikä on branchin tila, paljon se on edellä mistäkin ja paljon on remotesta tulossa ja niin edespäin. Nuolet ylös ja alas ja muuttuneiden tiedostojen määrä, ja sitten sitä painiketta klikkaamalla tulee tarkemmat tiedot siitä, mitä siinä on. Tästä voi tehdä kans prototyypin."

In the agent (conversation) view: the current branch, its state, ahead/behind its upstream and the base branch (↑/↓), incoming changes from the remote, changed-file counts; clicking opens details (which commits ahead/behind, which files changed, upstream, last fetch). Today the workspace page has a Git pill and Git-tiedot; start from what they already show and what the daemon already observes natively (snapshot `git` phase), and note any host facts the views need (e.g. fetch freshness, base-branch comparison).

Prototype round with three directions on one named axis: where the Git summary sits in the conversation view (top bar, near the composer, the strip), how dense it is, and what the details look like, desktop and phone.

## Acceptance Criteria
- [ ] Prototype round with three directions, host facts the views assume, and questions for Jari in result.md.
