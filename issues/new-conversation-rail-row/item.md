---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Unsent new conversation is missing from the rail and its rail row offers Archive

## Description

Jari 8.11.2026, two observations about a new conversation:

1. In a new (empty) conversation the top bar has the close ×, not Archive,
   but the conversation's row in the left rail still offers Archive. The rail
   row and the top bar must offer the same action.
2. A new conversation started from the rail (*Uusi keskustelu*, also when
   started with a chosen agent) that has not been sent does not appear in the
   rail. If the person moves elsewhere before sending, there is no way back to
   it, and its draft is effectively lost. It should appear in the rail as its
   own row until it is sent or closed.

Defect fix, not experimental. Expect the rail (`web/src/components/Navigation.tsx`
and the rail rows), `web/src/app/PendingConversation.tsx` and the draft store.
