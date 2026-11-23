---
created: 2026-11-18
updated: 2026-11-23
type: task
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-18/pi-rewind-own-repo
lane: pi-extension-repos
lane_seq: 3
blocked_by: ['@pi-web-search-own-repo', '@rewind-tracks-all-changes']
preparation: ready
closed: 2026-11-23
---

# Prepare the upstream rewind fork

## Description

Maintain `Open-Habitat/better-pi-rewind:turn-snapshots` as the source of a later
pull request to Raine, carrying the recorder Habitat actually runs and its
portable restore safety fixes. Keep Habitat's browser/RPC adapter here.

The original proposal was a separate `Open-Habitat/pi-rewind` package and a
pinned runtime dependency. Jari's 23 November 2026 decision supersedes that:
no separate package, no adapter removal and no runtime dependency migration.
The comparison and delivered fork are recorded in [result.md](result.md).

The pull request itself waits for Jari's decision after a couple of weeks of
real use, as agreed on 22 November. Preparing the fork does not authorize
submission or establish real-use acceptance. The unposted draft remains in
`issues/turn-changes-service-design/upstream-pr.md`.

## Acceptance Criteria

- [x] Record the comparison against current public better-pi-rewind before publishing.
- [x] Create a public Open-Habitat fork and push `turn-snapshots` from the reviewed bundle, reconciled with current main.
- [x] Carry subsequent generic undo/ignore/fallback-scope safety fixes while keeping Habitat protocol, preferences and navigation local.
- [x] Pass upstream tests and verify byte identity of portable code with Habitat's embedded copy.
- [x] Record file mapping and synchronization checklist; update the unposted PR draft.
- [x] Leave upstream PR submission to Jari's later decision.

## Decisions

### 2026-11-23T05:51:12Z · @jari

Jari 23.11.2026: no separate pi-rewind package, but there must be a repository from which we make the pull request to Raine: an Open-Habitat fork of better-pi-rewind carrying our changes on a branch, kept in sync with Habitat's embedded copy. The pull request itself is opened later, after a couple of weeks of real use (22.11. decision).
