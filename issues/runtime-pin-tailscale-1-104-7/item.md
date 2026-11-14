---
created: 2026-11-13
updated: 2026-11-14
type: chore
reporter: runtime-pin-watch
status: open
priority: normal
labels: [runtime-pin]
provenance: other
provenance_detail: runtime pin watch
source_ref: runtime-pin:tailscale@1.104.7
lane: runtime-pins
lane_seq: 10
preparation: ready
---

# Runtime pin: tailscale 1.104.7 is available (pinned 1.104.4)

## Description

A newer stable upstream release of a runtime component that Open Habitat pins is available.

- Component: `tailscale` (github:tailscale/tailscale)
- Pinned on main: 1.104.4 in `runtime/profiles/integrations/artifact-lock.json`
- New stable release: 1.104.7, published 2026-11-12
- Release: https://github.com/tailscale/tailscale/releases/tag/v1.104.7

A research run assesses this release before it is scheduled and writes its
findings and a verdict (safe-to-bump, needs-work or hold) to research.md in
this issue directory. A safe-to-bump release is raised automatically; anything
else stays here for the conductor.
