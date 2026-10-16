---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: open
priority: high
lane: unlaned
collision: [issues/ui-responsiveness-review]
preparation: ready
---

# Research: why browser actions feel slow, and whether the UI needs a structural change to feel snappy

Jari, 2026-10-16 ~18:55 local, after archiving a workspace was slow (both the archive button and its confirm): look at the browser UI as a whole for the causes of lag and slowness. With almost every new feature, every click has to wait for the UI updates to come back, instead of the app being snappy. Should the code get a more fundamental reorganisation so that it works pleasantly and consistently?

Earlier work: ADR 0008 (snappy conversation switching) and ADR 0009 (conversation state ownership) solved reading and switching; `design-snappy-conversation-switching` has measurements. This question is about actions (mutations): archive, +, settings saves, workspace actions, send, and how their results reach the screen.

Research and recommendation for Jari; architecture is decided with him and recorded in an ADR afterwards. Report: `analysis.md` here.

## Acceptance Criteria
- [ ] `analysis.md` names measured causes (lab and live evidence) per action class, compares at least two structural options with the current pattern, and recommends one with a migration path.
