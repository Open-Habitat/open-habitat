---
created: 2026-11-01
updated: 2026-11-02
type: task
reporter: jari
status: done
priority: normal
lane: decide-view-stable-address
lane_seq: 1
closed_by: conductor
preparation: pending
closed: 2026-11-01
---

# Decide: one stable address per view (option 2)

Jari 1.11.: unless a real harm can be articulated, views get option 2 from `research-view-stable-address`: the address *Avaa omalle välilehdelle* opens and *Kopioi linkki* copies is the same before and after publication. The conductor named the two concrete harms to him (an old private-address copy starts working when published; republishing after expiry or revocation revives every earlier recipient's copy) and both are accepted unless he says otherwise.

Write the ADR (`docs/decisions/`) that settles the research's three open questions with a recommendation each: stable entry address vs. stable address bar; old copies revive vs. rotation (Jari's direction: revive, no rotation); and what the address belongs to. On the last, Jari's model (1.11.): **the link is a property of the view, and its state (public, expiry) shows the same on every card that shows that view.** Settle what happens when an agent offers a new version of the same content (a new frozen view today): does it continue the earlier view's address and publication, and how is "the same content" recognised (source path, explicit agent flag, the person's choice), and what happens to today's movable share link (*Vaihda sisältö*) and multiple links per view. Keep the three authorities (gateway, daemon, provision) as they are. The ADR ends in the implementation issues it implies, each a worker-sized unit.

## Resolution

### 2026-11-01T15:43:48Z · @conductor

Jari 1.11.: ADR 0035 accepted, both explicit approvals ok.
