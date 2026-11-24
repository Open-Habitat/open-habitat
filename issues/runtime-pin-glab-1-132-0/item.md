---
created: 2026-11-24
updated: 2026-11-24
type: chore
reporter: runtime-pin-watch
status: open
priority: normal
labels: [runtime-pin]
provenance: other
provenance_detail: runtime pin watch
source_ref: runtime-pin:glab@1.132.0
lane: runtime-pins
lane_seq: 25
preparation: ready
---

# Runtime pin: glab 1.132.0 is available (pinned 1.130.0)

## Description

A newer stable upstream release of a runtime component that Open Habitat pins is available.

- Component: `glab` (gitlab:gitlab-org/cli)
- Pinned on main: 1.130.0 in `runtime/profiles/integrations/artifact-lock.json`
- New stable release: 1.132.0, published 2026-11-24
- Release: https://gitlab.com/gitlab-org/cli/-/releases/v1.132.0
- Supersedes the earlier finding for glab@1.130.0, glab@1.131.0.

A research run assesses this release before it is scheduled and writes its
findings and a verdict (safe-to-bump, needs-work or hold) to research.md in
this issue directory. A safe-to-bump release is raised automatically; anything
else stays here for the conductor.
