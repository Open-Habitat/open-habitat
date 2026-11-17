---
created: 2026-11-17
updated: 2026-11-17
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-16/gate-leaves-gigabytes-behind
lane: unlaned
lane_seq: 1
preparation: ready
---

# Each clean-gate run leaves 4–5 GB behind in the person's home

## Description

16.11.2026 on the staging installation: the home quota filled up; another agent found that every run of the clean gate (scripts/ci-local.sh --clean, run in a disposable clone as the release process requires) left 4–5 GB of leftovers (build outputs, installed dependencies, browser artefacts, caches) that nothing removes. Three runs in one afternoon contributed most of the fill. Find what the gate writes outside its own tree and what it leaves inside the clone, clean up what is disposable when it finishes (keeping the receipt), and document what a release operator may delete.
