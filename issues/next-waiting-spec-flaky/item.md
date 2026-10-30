---
created: 2026-10-30
updated: 2026-10-30
type: bug
reporter: agent
status: open
priority: normal
lane: browser-tests
lane_seq: 2
preparation: ready
---

# next-waiting-row spec sees an empty round under whole-suite load

## Description


## Description

Whole browser suite on main (`f0583be8`, 30.10., default workers) failed one
case: `web/tests/next-waiting-row.spec.ts:60` (*the waiting conversations are
walked as one round…*): the round's conversation list was `[]` where five
`pi:` ids were expected. The same spec passed 3/3 alone with
`OH_BROWSER_WORKERS=2`. 490 other cases passed. Likely the spec reads the
round once before the rail's waiting state has arrived under load.

## Acceptance Criteria

- [ ] The spec waits on the real state (poll the round/rail, not a single
      read); if the product starts a round from incomplete state, fix the
      product instead. Proven by repeated runs under load.
