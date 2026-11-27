---
created: 2026-11-27
updated: 2026-11-27
type: task
reporter: conductor
status: testing
priority: normal
provenance: chat
source_ref: chat:conductor-2711/m365-guest-probe
lane: m365-tenants
lane_seq: 4
preparation: ready
---

# Microsoft multi-tenant: guest mailbox probe so guests get the files-only card

## Description

Gap left by m365-tenants-ui (run 01m8ey3cepv83agzgax9y4gea3): the daemon's guest mailbox probe from passably-subdued-sticks design.md section 5 is not built, so a B2B guest connection shows the mail area although a guest normally has no mailbox. Build the probe so a guest connection with only files is shown as the files-only card. Part of the approved design.
