---
created: 2026-11-23
updated: 2026-11-24
type: chore
reporter: runtime-pin-watch
status: obsolete
priority: normal
labels: [runtime-pin]
provenance: other
provenance_detail: runtime pin watch
source_ref: runtime-pin:glab@1.131.0
lane: runtime-pins
lane_seq: 18
preparation: ready
closed: 2026-11-24
closed_by: runtime-pin-watch
---

# Runtime pin: glab 1.131.0 is available (pinned 1.130.0)

## Description

A newer stable upstream release of a runtime component that Open Habitat pins is available.

- Component: `glab` (gitlab:gitlab-org/cli)
- Pinned on main: 1.130.0 in `runtime/profiles/integrations/artifact-lock.json`
- New stable release: 1.131.0, published 2026-11-17
- Release: https://gitlab.com/gitlab-org/cli/-/releases/v1.131.0
- Supersedes the earlier finding for glab@1.130.0.

A research run assesses this release before it is scheduled and writes its
findings and a verdict (safe-to-bump, needs-work or hold) to research.md in
this issue directory. A safe-to-bump release is raised automatically; anything
else stays here for the conductor.

## Resolution

### 2026-11-24T14:11:34Z · @runtime-pin-watch

Runtime pin watch: superseded.
