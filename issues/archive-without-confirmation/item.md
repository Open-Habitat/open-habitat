---
created: 2026-10-14
updated: 2026-10-14
type: improvement
reporter: jari
status: in-progress
priority: normal
lane: web
lane_seq: 27
collision: [web/]
---

# Archive without confirmation and return to the workspace view

Jari, pilot.59 (2026-10-14):
- Archiving a conversation needs **no confirmation**. Archive immediately.
- After archiving, the window moves to the **repository/workspace view** of that conversation's workspace instead of staying on the archived conversation.

A floating notice ("Arkistoitu" with a Palauta button) replaces the confirmation's safety. Its look is queued for a prototype round (TODO.md). Restore already exists (`changeArchive(agent, false)` in `web/src/app/App.tsx`). Until the prototype lands, show no new notice: the archived list remains the way back.

## Acceptance Criteria

- [ ] The archive action has no confirmation step (desktop and phone).
- [ ] After a successful archive, the app navigates to the workspace view, and the archived conversation is in the archived group.
- [ ] A failed archive keeps the user on the conversation and shows the existing error.
