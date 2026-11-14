---
created: 2026-11-14
updated: 2026-11-14
type: bug
reporter: jari
status: open
priority: high
provenance: chat
source_ref: chat:2026-11-14/rail-open-moves-section
lane: unlaned
lane_seq: 1
collision: [web/src/app/railNow.ts]
preparation: ready
---

# Opening a conversation moves it from Sinun vuorosi to Käynnissä

## Description

Observed on a staging installation (14.11.2026): the
conductor conversation sat in *Sinun vuorosi* with a new reply. The person
clicked it open, and at that moment it dropped to *Käynnissä*, while the
conversation was open and nothing else had changed. Opening a conversation
must not move it between sections (the rail's own comment: "Opening a reply
no longer answers it; it waits, read, until the person replies or says Ei
nyt").

Cause (conductor's reading of `web/src/app/railNow.ts`): an unseen reply
claims the turn through `attention` regardless of liveness, but a seen reply
claims it only through `read = !live && !!reply && facts.attention ===
"seen" && !dismissed`. The conversation has background processes the agent
waits on (`taskfleet run wait`, an upgrade `await`; activity
`waiting_background`), so `live` is true; the moment the reply becomes seen,
`read` is false and the row falls to Käynnissä.

Expected: seen and unseen replies place the row in the same section; only
the person's reply, Ei nyt, or a new turn starting moves it. (Whether a
reply should claim *Sinun vuorosi* at all while the agent waits on its own
workers is the separate `agent-sets-rail-state` design; this fix only makes
opening neutral.) A regression test must pin that opening never changes the
section, with live background work, a busy worker, and nothing live.
