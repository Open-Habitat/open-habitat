---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: open
priority: normal
lane: pi-runtime
blocked_by: ['@lazy-resume-on-send']
collision: [internal/daemon]
preparation: ready
---

# Tell a resumed parent which spinoffs settled while Pi was down

Jari's decision 2026-10-16 on `taskfleet-pi-extension` (analysis.md): Open Habitat's own companion Pi extension may add a message about spinoffs to a resumed conversation. "Miksi ei saisi? Totta kai." When a parent conversation's Pi resumes (lazy resume on send, `lazy-resume-on-send`) and some of its Taskfleet spinoffs settled while Pi was down, the extension adds one context message saying which ones settled and how (landed, failed, awaiting). As the analysis recommends, the message does not trigger a turn by itself (`triggerTurn: false`); it rides along with the person's message that caused the resume. Sources are only Taskfleet's own records and the conversation's Pi branch, read as the mapped user; nothing is stored by Open Habitat.

This amends ADR 0017 (`docs/decisions/adr-0017-observe-taskfleet-spinoffs.md`), which forbade injected messages into the parent; that rule was written about the daemon. Update the ADR with this decision and its reasons as part of the work.

## Acceptance Criteria
- [ ] ADR 0017 amended with Jari's decision.
- [ ] After a daemon restart during a running spinoff, the resumed parent's next turn sees which spinoffs settled; no message when nothing settled (test).
