---
created: 2026-10-27
updated: 2026-10-27
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-10-26/view-offer-current-needs-workspace
lane: offers
preparation: ready
closed: 2026-10-27
---

# agent view offer --current still requires --workspace

## Description

Testihavainto, kirjattu KOKEILTAVAA.md:stä 2026-10-27:

`open-habitat agent view offer --current` vaatii silti `--workspace`-valinnan (0.0.0-pilot.421, 26.10.): ilman sitä tulee `invalid_arguments: invalid --workspace ""`, vaikka ohjeen mukaan `--current` ratkaisee `OPEN_HABITAT_WORKSPACE_ID`:n, ja `editor offer --current` toimi ilman. Agentti joutuu hakemaan ws-tunnisteen erikseen.
