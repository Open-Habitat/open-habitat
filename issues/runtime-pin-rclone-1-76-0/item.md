---
created: 2026-11-13
updated: 2026-11-22
type: chore
reporter: runtime-pin-watch
status: done
priority: normal
labels: [runtime-pin]
provenance: other
provenance_detail: runtime pin watch
source_ref: runtime-pin:rclone@1.76.0
lane: runtime-pins
lane_seq: 9
preparation: pending
closed: 2026-11-22
---

# Runtime pin: rclone 1.76.0 is available (pinned 1.71.2)

## Description

A newer stable upstream release of a runtime component that Open Habitat pins is available.

- Component: `rclone` (github:rclone/rclone)
- Pinned on main: 1.71.2 in `runtime/profiles/integrations/artifact-lock.json`
- New stable release: 1.76.0, published 2026-11-06
- Release: https://github.com/rclone/rclone/releases/tag/v1.76.0

A research run assesses this release before it is scheduled and writes its
findings and a verdict (safe-to-bump, needs-work or hold) to research.md in
this issue directory. A safe-to-bump release is raised automatically; anything
else stays here for the conductor.

## Comments

### 2026-11-22T19:35:00Z · @agent

The 1.76.0 bump is implemented with the conflict-winner deletion fix. Both official archive and member hashes are pinned and both binaries share regenerated verified notices. ARM64 profile build, sealed-runtime test, native local-backend bisync safety regressions and host acceptance pass. Microsoft native refresh is not qualified: the unchanged opt-in fixture panics before invoking rclone with either version; tracked separately as microsoft-native-refresh-fixture-stale. See dropbox-conflict-winner-returns-after-delete/result.md for evidence and limits.
