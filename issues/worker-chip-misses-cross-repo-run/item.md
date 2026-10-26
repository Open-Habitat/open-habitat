---
created: 2026-10-26
updated: 2026-10-26
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
collision: [web/src/components/BackgroundStrip.tsx]
preparation: ready
closed: 2026-10-26
closed_by: agent:taskfleet-run-01m5w917anb75gwtxpzgp4mk10
---

# Worker chip shows no workers while a run this conversation created is live

## Description

Jari, 2026-10-26, Birch pilot.12 (same screenshot as
`restart-notice-presentation`): the bottom chips of his conductor
conversation (`pi:563422a4-8ebd-4a66-8a2a-f5cb0de16a51`, workspace
`~/src/open-habitat`) showed no worker, although run
01m5w60pxynq08hyrxde3s1dyn was live (status pending, supervisor and Claude
worker alive). That run was created from this conversation
(`created_by_session` = pi/563422a4…, `TASKFLEET_CREATOR_SESSION` set) with
`source_repo` `~/Sources/fleetrepo`, i.e. another repository. The Habitat guide
promises such cross-repository runs are observed in the parent conversation's
spinoffs.

Find why it was missing: the cross-repo scan (source outside `~/src`), the
restart, or the stalled/supervisor classification. Fix, with a test for a
cross-repository run created by the conversation.

## Acceptance Criteria

- [ ] A live run created by the conversation shows in its worker chip
  whatever repository it works in, also after a conversation restart; tests.

## Resolution

### 2026-10-26T14:37:39Z · @agent:taskfleet-run-01m5w917anb75gwtxpzgp4mk10

Taskfleet 0.17.1 falsely read the live supervisor as dead (clock-step identity, fixed upstream 7026d09f, unreleased); Habitat's closed pill then hid the unknown-state run. The pill now marks every live run; see result.md.
