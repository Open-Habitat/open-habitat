---
created: 2026-10-13
updated: 2026-10-13
type: bug
status: fixed
priority: normal
lane: web
lane_seq: 16
collision: [web/]
closed: 2026-10-13
closed_by: claude
---

# Archive takes effect only after a long delay and the row misbehaves meanwhile

Jari, 2026-10-13 on the test server: pressing Archive (after confirming)
first seemed to do nothing; the conversation was archived only after a long
delay. During the delay, clicking or holding the conversation in the left
sidebar misbehaved and showed warnings.

## Agreed behaviour

After the confirmation the conversation leaves the sidebar list at once and
the toast says where it went (`design-system/design.md`, Ikonirivi
paragraph, and the draft's archive flow in
`design-system/drafts/Agentin vuoro.proto.html`). While the host completes
the request the row is not interactive in a broken way; if the host refuses
or fails, the row returns with an honest error and nothing is reported as
archived that was not.

## Done when

- Root cause of the delay is identified and recorded in `result.md`
  (browser waiting on a slow call, refresh cadence, or host latency), and
  either fixed or, when it is the host's real latency, hidden behind the
  immediate list update with failure rollback.
- The warnings Jari saw during the delay are reproduced in the lab or tests
  and no longer appear.
- Tests cover immediate removal, success and failure rollback.

## Reopen Notes — 2026-10-13

Re-stamped after the restored native-history top-bar action and the full browser spec were verified; the archive implementation and rollback remained unchanged.

