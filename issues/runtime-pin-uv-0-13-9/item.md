---
created: 2026-11-23
updated: 2026-11-23
type: chore
reporter: runtime-pin-watch
status: open
priority: normal
labels: [runtime-pin]
provenance: other
provenance_detail: runtime pin watch
source_ref: runtime-pin:uv@0.13.9
lane: runtime-pins
lane_seq: 21
preparation: ready
---

# Runtime pin: uv 0.13.9 is available (pinned 0.12.13)

## Description

A newer stable upstream release of a runtime component that Open Habitat pins is available.

- Component: `uv` (github:astral-sh/uv)
- Pinned on main: 0.12.13 in `runtime/profiles/uv/artifact-lock.json`
- New stable release: 0.13.9, published 2026-11-17
- Release: https://github.com/astral-sh/uv/releases/tag/0.13.9
- Supersedes the earlier finding for uv@0.13.8.

A research run assesses this release before it is scheduled and writes its
findings and a verdict (safe-to-bump, needs-work or hold) to research.md in
this issue directory. A safe-to-bump release is raised automatically; anything
else stays here for the conductor.
