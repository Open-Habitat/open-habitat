---
created: 2026-10-21
updated: 2026-10-21
type: bug
status: fixed
priority: high
lane: unlaned
preparation: ready
closed: 2026-10-21
---

# Lab browser suite red: composer-area cases and git-less warm workspace

## Description

Full gate on main 34018c54+ (2026-10-21, log /var/tmp/oh-gate-20261021.log): lab config 57 passed / 5 failed. lab-composer-area.spec.ts cases fail (focus, list width, Pi list/workspace visibility), and lab/session.mjs runs 'git rev-parse --short HEAD', which fails in Fleetrepo's warm Cedar workspace because only Git-listed files are synced, not .git. Goal: lab suite green on the warm path and natively, without weakening assertions.

## Acceptance Criteria

- [x] Lab snapshots work in Git-less source exports without syncing `.git`.
- [x] Composer journeys assert the native controls and current keyboard order without reducing coverage.
- [x] Reopening a controlled conversation follows latest through footer height changes; editor width reflow remains anchored.
