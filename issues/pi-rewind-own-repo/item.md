---
created: 2026-11-18
updated: 2026-11-23
type: task
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-18/pi-rewind-own-repo
lane: pi-extension-repos
lane_seq: 3
blocked_by: ['@pi-web-search-own-repo', '@rewind-tracks-all-changes']
preparation: pending
---

# Rewind extension moves to its own repository, Open-Habitat/pi-rewind

## Description

Originally proposed: move `internal/daemon/rewind-extension.mjs` to a new public repository `Open-Habitat/pi-rewind` and consume it from there, following the pattern `@pi-web-search-own-repo` established. The extension returns a conversation to an earlier message of the person's and optionally restores the files the agent changed after it. Pi stays the sole history writer and file copies stay under the person's own `~/.pi/agent/file-history/`.

Its checkpoint capture, tracked-path rules and restore are adapted from better-pi-rewind (Raine, MIT). The prerequisite `@rewind-tracks-all-changes` closed on 23 November 2026; rewind now consumes the recorder in `internal/daemon/turn-snapshots/` as well as per-file copies. Although it reads no Habitat environment variable or socket, it is not independent of Habitat: `rewindEnabled` reads Habitat's experimental preference, the daemon controls recorder loading, and `/oh-rewind` is a machine-facing protocol rather than a terminal selector.

## Why its own repository

Jari 18.11.2026: the Pi extensions that do not depend on Open Habitat go to their own repositories under the Open-Habitat organization, one repository per extension. Pi installs a git source as one package (`pi install git:github.com/<owner>/<repo>@<ref>`), its package gallery lists packages by the `pi-package` keyword, and each package shows its own changelog, so one repository per extension is what gives a Pi user without Open Habitat a direct install, a page, a README and an issue tracker for that extension. The product keeps consuming it as a locked dependency of the core runtime, as it already does with `@aliou/pi-processes`.

Extensions that are the daemon's other half (`process-extension.mjs`, `recap-extension.mjs` with `background-model.mjs`, `taskfleet-skills.mjs`, the `*_helper.mjs` scripts) stay in this repository.

## Preparation assessment — 23 November 2026

**Recommendation for Jari: upstream contributions after the agreed real-use period, not a separate rewind package now.** [The comparison](result.md) pins freshly fetched public better-pi-rewind to `e42fa9cbf14c300867fb2f31511979dde1898aee` (v0.4.0), distinguishes its code from the unsubmitted recorder proposal, and separates reusable additions from Habitat integration.

The substantial general-purpose addition is the recorder: every file carried under `internal/daemon/turn-snapshots/` is byte-identical to the existing upstream-shaped proposal. Snapshot coverage, scoped restoration, undo and per-file storage improvements can benefit upstream users. Habitat's preferences, JSON command/outcome protocol, continuation markers and browser previews are the adapter, not a competing terminal product. Current upstream already provides the Pi/OMP terminal package; the recorder proposal alone does not yet connect snapshots to its `/rewind` UI.

Set `preparation: pending` for Jari's review. His 22 November 2026 decision in `@turn-changes-service-design` requires a couple of weeks of real use before the upstream offer; the prepared text remains in `issues/turn-changes-service-design/upstream-pr.md`. Publishing the recorder in a separate package now would get ahead of that decision. Only the first acceptance criterion is complete. No repository creation, publication, code move or upstream submission is authorized by this assessment; the remaining criteria are retained pending Jari's direction.

## Acceptance Criteria

- [x] Before anything is published, the issue records how the extension now differs from better-pi-rewind. If the difference is small enough that offering it upstream would serve Pi users better than a second package, the issue returns to `pending` with that recommendation for Jari instead of proceeding.
- [ ] `Open-Habitat/pi-rewind` exists as a public MIT repository with the extension, its tests, README, changelog and Pi package manifest; the README states its origin in better-pi-rewind and what differs, and the upstream licence notice is kept. The conductor creates the repository.
- [ ] The extension works in a plain Pi, including the terminal TUI, or the README says plainly which modes it supports; nothing in it is worded for the browser only.
- [ ] The daemon's side of rewind (`rewind_linux.go`) drives the packaged extension through the same interface as now, and the browser's "return here" behaves as before, file restoration included.
- [ ] The core runtime takes the extension at a pinned version with its licence recorded, and `internal/daemon/rewind-extension.mjs` is gone from this repository.
