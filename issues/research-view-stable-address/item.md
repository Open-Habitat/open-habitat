---
created: 2026-11-01
updated: 2026-11-01
type: task
reporter: jari
status: open
priority: normal
lane: research-view-stable-address
lane_seq: 1
related: ['@proto-view-offer-card-r2']
preparation: ready
---

# Research: what a stable per-view address would cost

Jari 1.11.: `proto-view-offer-card-r2` keeps address option 1 (a public address born at publication) for now, but find out whether option 2 (one stable address per view that *Avaa omalle välilehdelle* opens and that becomes publicly reachable when the view is made public) is really too big a change to be worth it. Map from the code what it would take: view origin and its isolation, how the private tab authenticates, the share token and expiry, the gateway's and daemon's roles, revocation, what an address seen while private would mean after publication and how to prevent it from becoming a key (for example rotating on publication), migration. Report in Finnish: the work and its parts, the security consequences, an estimate of size, and a recommendation. Research only, no product code.
