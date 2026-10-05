---
created: 2026-10-05
updated: 2026-10-05
type: bug
status: open
priority: normal
related: ['@rethink-project-docs']
lane: github-first-onboarding
collision: [internal/daemon/, docs/]
---

# Keep large workspace collections visible beyond 512 entries

## Problem

Adding one entry to ~/src can make every workspace disappear from the daemon's
snapshot. Discovery reads 513 immediate directory entries and, if more than
512 exist, returns partial/entry_limit before classifying any of them. Files
and hidden entries count too; files inside projects do not. The clone and
checkout observation paths have similar entry-count cutoffs.

For example, 500 project directories plus 13 ordinary files produce an empty
workspace observation even though all projects remain readable on disk.
The limit bounds scan work, but there is no established product need for a
512-entry ceiling or for dropping every result when it is crossed.

## Agreed outcome

Jari approved processing discovery in batches so large workspace collections
remain visible during the documentation review on 2026-10-05. Replace the
all-or-nothing cutoff with bounded work that can cover the whole collection.
Preserve the native directories as the source; no workspace registry is needed.

Follow the result through snapshot construction and browser consumption so
transport limits or partial-result handling do not recreate the disappearance.
Inspect the related clone and checkout scans so a large collection does not
arbitrarily disable onboarding. Keep complete destination-name collision
checks, including case-insensitive collisions, before a clone writes.

## Verification

Exercise a collection above 512 entries with both directories and ordinary
files. Show that adding the threshold-crossing entry preserves existing
workspaces and makes the new workspace discoverable. Verify completeness
across batches and the treatment of inaccessible entries, and check the
onboarding paths against large collections and a conflicting destination
beyond the first batch. Update the architecture description to match the
implemented behavior.

Source: internal/daemon discovery, snapshot, GitHub clone and checkout
observation. This task implements discovery behavior; @design-user-storage-quotas
owns storage limits independently.
