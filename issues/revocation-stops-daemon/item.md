---
created: 2026-11-10
updated: 2026-11-10
type: task
reporter: jari
status: open
priority: normal
related: ['@withdrawal-sockets-block-jit-gate']
preparation: ready
lane: revocation-stops-daemon
lane_seq: 1
---

# Root revocation stops the person's daemon and sockets like withdrawal

## Description

Jari 10.11.2026: when root removes a person from `site.json` (root
revocation, applied by `host apply`), the person's Open Habitat daemon and
both sockets are stopped exactly as a browser withdrawal now stops them
(`withdrawal-sockets-block-jit-gate`). There is no reason to leave them
running: the gateway no longer routes to the person, and a running listener
only keeps their browser-started agents alive and can block the test guest's
activation gate. The account, home, credentials, user manager and SSH stay.
Restoring the person in `site.json` and their next sign-in bring the sockets
back.
