---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: needs-info
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-11-22/shared-view-link-not-opening
lane: unlaned
preparation: ready
---

# A view shared by link does not open in another browser

## Description

Test server (pilot.847–853, 22.11.2026): an agent view was shared with the card's 'Jaa linkillä' and the link opened in another browser without signing in: 'The view could not be opened. It may have been removed, or you have signed out. Open it again from Habitat.' Expected: the public view opens without sign-in. The server upgraded during the test; 'open-habitat agent view list' does not show sharing state, so the agent could not check whether the share was active. Related: view-address-access-exemption, view-address-reservations.
