---
created: 2026-10-22
updated: 2026-10-22
type: bug
reporter: jari
status: fixed
priority: normal
lane: conversation-title
lane_seq: 1
related: ['@retitle-still-fails']
collision: [web/conversation-title]
preparation: ready
closed: 2026-10-22
---

# Title regeneration still fails on the test server after the timeout fix

## Description

Jari 2026-10-22 ~08:20 on the test server (pilot.306, 43491020, which includes retitle-still-fails' fix 0ff6d58d/810681e3): regenerating a conversation title still shows an error. retitle-still-fails concluded the reply was lost to the five-second write deadline; that fix did not resolve Jari's case, so the diagnosis was incomplete. Read the test server's gateway/daemon logs for Jari's attempts around 08:00–08:30 UTC+3 (Fleetrepo owns access; see AGENTS-WORKFLOW.md and Fleetrepo infra/open-habitat-test docs; never copy private workspace content into the repo), reproduce the exact path, fix the actual cause and verify on the test server after release (the conductor pushes; verify once the watcher reports the new version installed).

## Acceptance Criteria

- [x] Inspect the live failure and distinguish it from the previous lost-response defect, without copying private conversation content.
- [x] Reproduce native cold startup exceeding the temporary child's acknowledgement budget and cover it with a failing-before/passing-after regression.
- [x] Keep native writer proofs and the no-automatic-retry policy unchanged; document focused validation and the conductor's post-release check.
