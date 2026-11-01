---
created: 2026-11-01
updated: 2026-11-01
type: task
reporter: jari
status: done
priority: normal
lane: proto-view-offer-card-r2
lane_seq: 1
related: ['@proto-view-offer-card']
preparation: pending
closed: 2026-11-01
closed_by: conductor
---

# Prototype round 2: view card with visibility control, one link

Jari 1.11. on `proto-view-offer-card`: go with direction **3 · Näkyvyys
säätimenä**, and riff on it:

- Changing visibility to public makes the view public at once, with no
  further step.
- Ideally there is no separate share link: the view's public address is the
  same address that *Avaa omalle välilehdelle* already opens.
- Once public, the card shows a *Kopioi linkki* button (or similar) among
  its buttons.
- The visibility control sits somewhere on the card; a view starts in a
  default state and stays there. No extra buttons or dialogs: save the
  person's clicks.

The second point touches how view links work today (a private view address
and a separate capability link with an expiry). The round finds out from the
code what the current addresses are and what using one address would mean
(who could open an address seen while it was private, how making it private
again revokes access, expiry, the view origin's isolation), shows the
directions, and states the architecture question for Jari separately in
`result.md`. It is not decided by the prototype.

Baseline is round 1's direction 3; 2–3 riffs on one axis, desktop and phone,
light and dark, site links on and off, Finnish texts.

## Resolution

### 2026-11-01T14:12:55Z · @conductor

Jari 1.11.: riff B, option 1 for now, no revoke sentence; round 3 riffs expiry; option 2 researched separately.
