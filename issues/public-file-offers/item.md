---
created: 2026-11-08
updated: 2026-11-08
type: feature
reporter: jari
status: open
priority: normal
lane: offer-cards-proto
lane_seq: 3
blocked_by: ['@offer-cards-and-assets-list']
preparation: ready
---

# Make file, table, image and folder offers public like views

## Description

Jari 8.11.2026 (`proto-offer-cards-consistent` rounds 2–3): every offer kind
(file, table, image, PDF, folder) can be made public the same way as HTML
views today: *Julkinen* with a duration and *Kopioi linkki*, at a stable
address, listed in Settings › Tili › Näkymien osoitteet. Round 2's
`result.md` lists what the host must add: accept file-offer ids in the ADR
0035 address reservation (`view-address-end-to-end`), a fixed daemon
offer-read route, a host-generated entry page per kind (folder as a file
list), the own-tab page, limits and the settings list.

This extends a public, unauthenticated surface: gateway authority, what an
anonymous reader can reach, and revocation must stay exactly as narrow as for
views (only the frozen offered copy, never a live workspace path). Decide
the remaining details by the view precedent and record them; stop and ask
only if the change would let a public link reach anything beyond the frozen
offer.

## Acceptance Criteria

- [ ] Each non-view offer kind can be made public and opened anonymously at its address; revocation and expiry work.
- [ ] Settings lists them with views.
- [ ] Go, contracts, web and browser specs green; independent review.
