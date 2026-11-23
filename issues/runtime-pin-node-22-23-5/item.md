---
created: 2026-11-13
updated: 2026-11-23
type: chore
reporter: runtime-pin-watch
status: done
priority: normal
labels:
- runtime-pin
- runtime-pin:bump-prepared
provenance: other
provenance_detail: runtime pin watch
source_ref: runtime-pin:node@22.23.5
lane: runtime-pins
lane_seq: 6
preparation: ready
closed: 2026-11-23
---

# Runtime pin: node 22.23.5 is available (pinned 22.21.1)

## Description

A newer stable upstream release of a runtime component that Open Habitat pins is available.

- Component: `node` (node:22)
- Pinned on main: 22.21.1 in `runtime/core/artifact-lock.json`, `runtime/profiles/integrations/artifact-lock.json`
- New stable release: 22.23.5, published 2026-11-11
- Release: https://nodejs.org/en/blog/release/v22.23.5

A research run assesses this release before it is scheduled and writes its
findings and a verdict (safe-to-bump, needs-work or hold) to research.md in
this issue directory. A safe-to-bump release is raised automatically; anything
else stays here for the conductor.

## Comments

### 2026-11-23T11:49:55Z · @runtime-pin-watch

An automatic bump of this release stopped before landing (run 01m7azx2syyqq2ax2t2kw619t6); its prepared branch stays in the runtime pin watch's own checkout for the conductor. The note recording this earlier never reached main.
