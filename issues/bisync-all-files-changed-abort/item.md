---
created: 2026-11-12
updated: 2026-11-12
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: taskfleet research run prototype (cloud write safety)
source_ref: taskfleet:01m77a7cnyqcfyft7ccrym0kpr/finding:bisync-all-files-changed
originating_run: 01m77a7cnyqcfyft7ccrym0kpr
originating_run_kind: research
lane: bisync-fixes
preparation: ready
lane_seq: 2
closed: 2026-11-12
commits:
- hash: 3b85cc45b
  summary: Resume an all-files-changed abort behind a deletion check
---

# Synced library stops for good when every file is edited (bisync 'all files were changed' abort, unnamed failure)

## Description

## Observation (prototype on Birch, 12.11.2026, rclone v1.71.2 from the integrations payload)

With the exact flags `microsoftBisync` uses today
(`--resilient --recover --max-lock 2m --max-delete 50 --conflict-resolve none
--conflict-loser num --create-empty-src-dirs --refresh-times --compare
size,modtime`), a pair of local directories was resynced, then every file on
the local side was edited (three Markdown files, the way an agent
reformatting a small folder would). Every following pass fails the same way:

    ERROR : Safety abort: all files were changed on Path1 "…/local/". Run with --force if desired.
    NOTICE: Bisync aborted. Please try again.
    NOTICE: Failed to bisync: all files were changed

The cloud copy stays at the old content and the abort repeats each pass,
because the listings are not updated. The same happens for a library that
holds a single file which the agent edits, and when both sides changed
all files.

## Why it matters

The local edits are not lost, but they never reach SharePoint/OneDrive and
nothing tells the person why. `passFailure`
(`internal/daemon/integrations/passes_linux.go`) recognises only
`too many deletes`, the resync messages and network errors, so this abort
has reason `""`, which the UI shows as an unnamed failure. Under the
cloud-files write direction (Jari 12.11.: agents edit fetched files) this
is a reachable case: an agent that edits every file of a small library
stops its sync indefinitely.

## Notes for the fix

bisync's check exists to stop a mass change (e.g. a timestamp wipe) from
propagating, so passing `--force` unconditionally drops a guard. Options:
classify the abort as its own reason with a clear message and an explicit
"sync anyway" action (a single `--force` pass), or apply `--force` only when
the library has very few files. Research context:
`issues/cloud-files-on-demand/research-write.md`.
