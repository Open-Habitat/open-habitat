---
created: 2026-11-18
updated: 2026-11-18
type: task
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-18/pi-rewind-own-repo
lane: pi-extension-repos
lane_seq: 3
blocked_by: ['@pi-web-search-own-repo', '@rewind-tracks-all-changes']
preparation: ready
---

# Rewind extension moves to its own repository, Open-Habitat/pi-rewind

## Description

## Description

Move `internal/daemon/rewind-extension.mjs` to a new public repository `Open-Habitat/pi-rewind` and consume it from there, following the pattern `@pi-web-search-own-repo` established. The extension returns a conversation to an earlier message of the person's and optionally restores the files the agent changed after it. Pi stays the sole history writer and file copies stay under the person's own `~/.pi/agent/file-history/`.

It reads no Open Habitat environment variable or socket, but it is loaded only by the daemon-owned Pi RPC child today and its checkpoint capture, tracked-path rules and restore are adapted from better-pi-rewind (Raine, MIT). It waits for `@rewind-tracks-all-changes` so the code is not moved while that change is being made in it.

## Why its own repository

Jari 18.11.2026: the Pi extensions that do not depend on Open Habitat go to their own repositories under the Open-Habitat organization, one repository per extension. Pi installs a git source as one package (`pi install git:github.com/<owner>/<repo>@<ref>`), its package gallery lists packages by the `pi-package` keyword, and each package shows its own changelog, so one repository per extension is what gives a Pi user without Open Habitat a direct install, a page, a README and an issue tracker for that extension. The product keeps consuming it as a locked dependency of the core runtime, as it already does with `@aliou/pi-processes`.

Extensions that are the daemon's other half (`process-extension.mjs`, `recap-extension.mjs` with `background-model.mjs`, `taskfleet-skills.mjs`, the `*_helper.mjs` scripts) stay in this repository.

## Acceptance Criteria

- [ ] Before anything is published, the issue records how the extension now differs from better-pi-rewind. If the difference is small enough that offering it upstream would serve Pi users better than a second package, the issue returns to `pending` with that recommendation for Jari instead of proceeding.
- [ ] `Open-Habitat/pi-rewind` exists as a public MIT repository with the extension, its tests, README, changelog and Pi package manifest; the README states its origin in better-pi-rewind and what differs, and the upstream licence notice is kept. The conductor creates the repository.
- [ ] The extension works in a plain Pi, including the terminal TUI, or the README says plainly which modes it supports; nothing in it is worded for the browser only.
- [ ] The daemon's side of rewind (`rewind_linux.go`) drives the packaged extension through the same interface as now, and the browser's "return here" behaves as before, file restoration included.
- [ ] The core runtime takes the extension at a pinned version with its licence recorded, and `internal/daemon/rewind-extension.mjs` is gone from this repository.
